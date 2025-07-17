import pandas as pd
import numpy as np
import re
import joblib
from scipy.sparse import hstack
from fastapi import FastAPI
from pydantic import BaseModel
import os

# --- 1. Load the saved model and components ---
try:
    model = joblib.load('saved_model/model.pkl')
    tfidf_vectorizer = joblib.load('saved_model/vectorizer.pkl')
    bad_words_list = joblib.load('saved_model/bad_words.pkl')
    print("--- Model and components loaded successfully. ---")
except FileNotFoundError:
    print("Error: Model files not found. Please make sure the 'saved_model' directory with the model files is in the same directory as this script.")
    exit()

# --- 2. FastAPI App Initialization ---
app = FastAPI(
    title="Parental Control API",
    description="An API to predict if a sentence is appropriate or not.",
    version="1.0.0"
)

# --- 3. Pydantic Model for Request Body ---
class SentenceInput(BaseModel):
    sentence: str

# --- 4. Prediction Functions ---
def count_bad_words(sentence: str, bad_words: list) -> int:
    """Counts bad words in a sentence."""
    if not isinstance(sentence, str):
        return 0
    count = 0
    for word in bad_words:
        if re.search(r'\b' + re.escape(word) + r'\b', sentence.lower()):
            count += 1
    return count

def predict_sentence(sentence: str):
    """Predicts if a single sentence is bad or not using the loaded components."""
    bad_word_count = count_bad_words(sentence, bad_words_list)
    tfidf_features = tfidf_vectorizer.transform([sentence])
    combined_features = hstack([tfidf_features, np.array([[bad_word_count]])])

    prediction = model.predict(combined_features)
    prediction_proba = model.predict_proba(combined_features)

    if prediction[0] == 1:
        return {
            "result": "BAD",
            "confidence": f"{prediction_proba[0][1]*100:.2f}%"
        }
    else:
        return {
            "result": "NOT BAD",
            "confidence": f"{prediction_proba[0][0]*100:.2f}%"
        }

# --- 5. API Endpoint ---
@app.post("/check-sentence/")
def check_sentence(sentence_input: SentenceInput):
    """
    This endpoint takes a sentence and returns a prediction on whether it is 'BAD' or 'NOT BAD'.
    """
    return predict_sentence(sentence_input.sentence)

# --- 6. Root Endpoint ---
@app.get("/")
def read_root():
    return {"message": "Welcome to the Parental Control API. Go to /docs to see the API documentation."}
