import pandas as pd
import numpy as np
import re
import os
import joblib

from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report
from scipy.sparse import hstack

try:
    labeled_df = pd.read_csv('data/parental_control_dataset.csv')
    bad_words_df = pd.read_csv('data/bad_words.csv', header=None)
    
    bad_words_list = []
    for column in bad_words_df.columns:
        bad_words_list.extend(bad_words_df[column].dropna().astype(str).tolist())
    bad_words_list = sorted(list(set([word.strip().lower() for word in bad_words_list])))

    print("--- Successfully loaded your datasets ---")
except FileNotFoundError as e:
    print(f"Error: Missing file: {e.filename}. Make sure datasets are in the same directory.")
    exit()

if 'label' in labeled_df.columns and 'is_bad' not in labeled_df.columns:
    labeled_df = labeled_df.rename(columns={'label': 'is_bad'})
elif 'flag' in labeled_df.columns and 'is_bad' not in labeled_df.columns:
     labeled_df = labeled_df.rename(columns={'flag': 'is_bad'})


def count_bad_words(sentence, bad_words):
    if not isinstance(sentence, str): return 0
    count = 0
    for word in bad_words:
        if re.search(r'\b' + re.escape(word) + r'\b', sentence.lower()):
            count += 1
    return count

labeled_df['bad_word_count'] = labeled_df['sentence'].apply(lambda x: count_bad_words(x, bad_words_list))

tfidf_vectorizer = TfidfVectorizer(stop_words='english', max_features=5000)
X_text = labeled_df['sentence'].astype(str)
y = labeled_df['is_bad']

X_tfidf = tfidf_vectorizer.fit_transform(X_text)
X_bad_word_count = labeled_df['bad_word_count'].values.reshape(-1, 1)
X_combined = hstack([X_tfidf, X_bad_word_count])

X_train, X_test, y_train, y_test = train_test_split(
    X_combined, y, test_size=0.2, random_state=42, stratify=y
)

model = LogisticRegression(class_weight='balanced', solver='liblinear', random_state=42)
model.fit(X_train, y_train)

y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
print(f"\n--- Model Evaluation on Test Set ---")
print(f"Model Accuracy: {accuracy * 100:.2f}%")
print("Classification Report:")
print(classification_report(y_test, y_pred))


os.makedirs('saved_model', exist_ok=True)

joblib.dump(model, 'saved_model/model.pkl')
joblib.dump(tfidf_vectorizer, 'saved_model/vectorizer.pkl')
joblib.dump(bad_words_list, 'saved_model/bad_words.pkl')

print("\n--- Model and components saved successfully! ---")
print("Saved files in 'saved_model/' directory.")