import os
import json
import re

# LLM Imports
from openai import AzureOpenAI, APIError
from dotenv import load_dotenv

# Local Model Imports
import pandas as pd
import numpy as np
import joblib
from scipy.sparse import hstack

# FastAPI Imports
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

# --- LLM Setup ---
print("--- Initializing LLM components... ---")
load_dotenv()
azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
azure_api_key = os.getenv("AZURE_OPENAI_API_KEY")
azure_api_version = os.getenv("AZURE_OPENAI_API_VERSION")
azure_deployment_name = os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT")
llm_client = None
if all([azure_endpoint, azure_api_key, azure_api_version, azure_deployment_name]):
    try:
        llm_client = AzureOpenAI(azure_endpoint=azure_endpoint, api_key=azure_api_key, api_version=azure_api_version)
        print("--- Azure OpenAI client initialized successfully. ---")
    except Exception as e:
        print(f"Error initializing Azure OpenAI client: {e}. The /check/llm endpoint will not be available.")
        llm_client = None
else:
    print("Warning: Azure OpenAI environment variables not set. The /check/llm endpoint will not be available.")


# --- Local Model Setup ---
print("\n--- Initializing local model components... ---")
try:
    local_model = joblib.load('saved_model/model.pkl')
    tfidf_vectorizer = joblib.load('saved_model/vectorizer.pkl')
    bad_words_list = joblib.load('saved_model/bad_words.pkl')
    local_model_loaded = True
    print("--- Local model and components loaded successfully. ---")
except FileNotFoundError:
    print("Warning: Local model files not found. The /check/local endpoint will not be available.")
    local_model_loaded = False


# --- FastAPI App Initialization ---
app = FastAPI(
    title="Hybrid Parental Control API",
    description="Provides access to both a fast local model and an advanced LLM for content moderation.",
    version="3.1.0"
)

origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"], 
)


# --- Pydantic Model for Request Body ---
class SentenceInput(BaseModel):
    sentence: str

# --- Prediction Functions (No changes below this line) ---
def count_bad_words(sentence: str, bad_words: list) -> int:
    if not isinstance(sentence, str): return 0
    count = 0
    for word in bad_words:
        if re.search(r'\b' + re.escape(word) + r'\b', sentence.lower()):
            count += 1
    return count

def predict_local_model(sentence: str):
    bad_word_count = count_bad_words(sentence, bad_words_list)
    tfidf_features = tfidf_vectorizer.transform([sentence])
    combined_features = hstack([tfidf_features, np.array([[bad_word_count]])])
    prediction = local_model.predict(combined_features)
    prediction_proba = local_model.predict_proba(combined_features)
    if prediction[0] == 1:
        return {"result": "BAD", "confidence": f"{prediction_proba[0][1]*100:.2f}%"}
    else:
        return {"result": "NOT BAD", "confidence": f"{prediction_proba[0][0]*100:.2f}%"}

def predict_llm(sentence: str):
    system_prompt = """
    You are a content moderation expert. Your task is to classify the given text as 'BAD' or 'NOT BAD'.
    'BAD' means the text is inappropriate, offensive, hateful, or contains profanity. Actually I use this model to detect cyber bullying and I creating a parental control extension. Therefore, 'BAD' means the text is not appropriate for children. Sometimes user may pass a message like this 'I kill you' or 'I hate you'. These are not appropriate for children. Therefore give just bad or notbad thing. Don't include any additional information or context.
    'NOT BAD' means the text is appropriate and safe.
    "your " is not a BAD word.
    You must also provide a confidence score as a percentage for your classification.
    Your final output must be a single, valid JSON object with two keys: "result" and "confidence".
    For example: {"result": "BAD", "confidence": "98.50%"}
    """
    try:
        response = llm_client.chat.completions.create(
            model=azure_deployment_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": sentence}
            ],
            temperature=0, max_tokens=50, top_p=1,
            frequency_penalty=0, presence_penalty=0,
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    except APIError as e:
        if e.code == 'content_filter':
            return {"result": "BAD", "confidence": "100.00%"}
        else:
            raise HTTPException(status_code=500, detail=f"An API error occurred: {str(e)}")
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="LLM returned a non-JSON response.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")


# --- API Endpoints ---
@app.post("/check/local/")
def check_sentence_local(sentence_input: SentenceInput):
    if not local_model_loaded:
        raise HTTPException(status_code=503, detail="Local model is not available.")
    if not sentence_input.sentence.strip():
        raise HTTPException(status_code=400, detail="Sentence cannot be empty.")

    result = predict_local_model(sentence_input.sentence)
    print("Local Model Result:", result, sentence_input.sentence)
    return result

@app.post("/check/llm/")
def check_sentence_llm(sentence_input: SentenceInput):
    if not llm_client:
        raise HTTPException(status_code=503, detail="LLM service is not available. Check API configuration.")
    if not sentence_input.sentence.strip():
        raise HTTPException(status_code=400, detail="Sentence cannot be empty.")

    result = predict_llm(sentence_input.sentence)
    print("LLM Model Result:", result, sentence_input.sentence)
    return result


# --- Root Endpoint ---
@app.get("/")
def read_root():
    return {
        "message": "Welcome to the Hybrid Parental Control API.",
        "endpoints": {
            "local_model": "POST /check/local/",
            "llm_model": "POST /check/llm/"
        }
    }
    
    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)