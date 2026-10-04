"""Train and save the first supervised CDR fraud-risk model."""

from __future__ import annotations

import csv
from collections import Counter
from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from create_training_data import (
    DATASET_PATH,
    FEATURE_COLUMNS,
    TARGET_COLUMN,
    create_training_data,
)


MODEL_DIR = Path(__file__).resolve().parent / "model"
MODEL_PATH = MODEL_DIR / "cdr_risk_model.joblib"
PREPROCESSING_PATH = MODEL_DIR / "cdr_risk_preprocessing.joblib"


def load_dataset():
    with DATASET_PATH.open("r", encoding="utf-8", newline="") as file:
        rows = list(csv.DictReader(file))
    features = [
        {
            key: (int(value) if key != "call_type" else value)
            for key, value in row.items()
            if key in FEATURE_COLUMNS
        }
        for row in rows
    ]
    labels = [int(row[TARGET_COLUMN]) for row in rows]
    features = pd.DataFrame(features)
    return features, labels


def train() -> None:
    create_training_data()
    features, labels = load_dataset()
    x_train, x_test, y_train, y_test = train_test_split(
        features,
        labels,
        test_size=0.2,
        random_state=42,
        stratify=labels,
    )

    categorical_features = ["call_type"]
    numeric_features = [column for column in FEATURE_COLUMNS if column not in categorical_features]
    preprocessing = ColumnTransformer(
        transformers=[
            ("categorical", OneHotEncoder(handle_unknown="ignore"), categorical_features),
            ("numeric", "passthrough", numeric_features),
        ]
    )
    classifier = RandomForestClassifier(
        n_estimators=250,
        random_state=42,
        class_weight="balanced",
        n_jobs=-1,
    )
    model = Pipeline(
        steps=[("preprocessing", preprocessing), ("classifier", classifier)]
    )
    model.fit(x_train, y_train)

    predictions = model.predict(x_test)
    print(f"Number of training records: {len(x_train)}")
    print(f"Class distribution: {dict(sorted(Counter(labels).items()))}")
    print(f"Test accuracy: {accuracy_score(y_test, predictions):.4f}")
    print("Classification report:")
    print(classification_report(y_test, predictions, target_names=["legitimate", "fraud"]))
    print("Confusion matrix:")
    print(confusion_matrix(y_test, predictions))

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    joblib.dump(
        {
            "feature_columns": FEATURE_COLUMNS,
            "categorical_features": categorical_features,
            "numeric_features": numeric_features,
            "target_column": TARGET_COLUMN,
        },
        PREPROCESSING_PATH,
    )
    print(f"Model file path: {MODEL_PATH}")
    print(f"Preprocessing file path: {PREPROCESSING_PATH}")


if __name__ == "__main__":
    train()
