import os
import json
from openai import AzureOpenAI, APIError
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

# --- 1. Load Environment Variables and Initialize Azure OpenAI Client ---

load_dotenv()

azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
azure_api_key = os.getenv("AZURE_OPENAI_API_KEY")
azure_api_version = os.getenv("AZURE_OPENAI_API_VERSION")
azure_deployment_name = os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT")

if not all([azure_endpoint, azure_api_key, azure_api_version, azure_deployment_name]):
    print("Error: One or more Azure OpenAI environment variables are not set.")
    print("Please create a .env file or set them in your environment.")
    exit()

try:
    client = AzureOpenAI(
        azure_endpoint=azure_endpoint,
        api_key=azure_api_key,
        api_version=azure_api_version
    )
    print("--- Azure OpenAI client initialized successfully. ---")
except Exception as e:
    print(f"Error initializing Azure OpenAI client: {e}")
    exit()


# --- 2. FastAPI App Initialization ---
app = FastAPI(
    title="Parental Control API using LLM",
    description="An API to predict if a sentence is appropriate or not using Azure OpenAI.",
    version="2.1.0"
)

# --- 3. Pydantic Model for Request Body ---
class SentenceInput(BaseModel):
    sentence: str

# --- 4. LLM Prediction Function ---
def get_llm_prediction(sentence: str):
    """
    Gets a prediction from Azure OpenAI to classify the sentence.
    Handles content filter errors by classifying them as 'BAD'.
    """
    system_prompt = """
    You are a content moderation expert. Your task is to classify the given text as 'BAD' or 'NOT BAD'.
    'BAD' means the text is inappropriate, offensive, hateful, or contains profanity. Actually I use this model to detect cyber bullying and I creating a parental control extension. Therefore, 'BAD' means the text is not appropriate for children. Sometimes user may pass a message like this 'I kill you' or 'I hate you'. These are not appropriate for children. Therefore give just bad or notbad thing. Don't include any additional information or context.
    'NOT BAD' means the text is appropriate and safe.
    You must also provide a confidence score as a percentage for your classification.
    Your final output must be a single, valid JSON object with two keys: "result" and "confidence".
    For example: {"result": "BAD", "confidence": "98.50%"}
    """

    try:
        response = client.chat.completions.create(
            model=azure_deployment_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": sentence}
            ],
            temperature=0,
            max_tokens=50,
            top_p=1,
            frequency_penalty=0,
            presence_penalty=0,
            response_format={"type": "json_object"}
        )

        prediction_json = json.loads(response.choices[0].message.content)
        return prediction_json

    except APIError as e:
        # --- START: New logic to handle content filter errors ---
        # Check if the error is specifically a content filter violation
        if e.code == 'content_filter':
            print(f"Content filter triggered for sentence: '{sentence}'. Classifying as BAD.")
            return {"result": "BAD", "confidence": "100.00%"}
        # If it's another type of API error, raise it as before
        else:
            raise HTTPException(status_code=500, detail=f"An API error occurred: {str(e)}")
        # --- END: New logic ---

    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="LLM returned a non-JSON response.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")


# --- 5. API Endpoint ---
@app.post("/check-sentence/")
def check_sentence(sentence_input: SentenceInput):
    """
    This endpoint takes a sentence and returns a prediction from the LLM
    on whether it is 'BAD' or 'NOT BAD'.
    """
    if not sentence_input.sentence.strip():
        raise HTTPException(status_code=400, detail="Sentence cannot be empty.")

    return get_llm_prediction(sentence_input.sentence)

# --- 6. Root Endpoint ---
@app.get("/")
def read_root():
    """
    Welcome endpoint for the API.
    """
    return {"message": "Welcome to the Parental Control API (LLM Version). Go to /docs to see the API documentation."}
