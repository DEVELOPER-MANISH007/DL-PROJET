from io import BytesIO
from pathlib import Path

import numpy as np
import tensorflow as tf
import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

app = FastAPI()

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR.parent / "Models" / "1.keras"

MODEL = tf.keras.models.load_model(MODEL_PATH)
CLASS_NAMES = ["Early Blight", "Late Blight", "Healthy"]

if MODEL.output_shape[-1] != len(CLASS_NAMES):
    raise ValueError(
        f"Model has {MODEL.output_shape[-1]} outputs but "
        f"{len(CLASS_NAMES)} class names are configured."
    )


@app.get("/ping")
async def ping():
    return {"message": "hello, I am live"}


def read_file_as_image(data: bytes) -> np.ndarray:
    try:
        with Image.open(BytesIO(data)) as image:
            image_array = np.asarray(image.convert("RGB"))
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is not a valid image.",
        ) from exc

    height, width = MODEL.input_shape[1:3]
    if height is None or width is None:
        raise ValueError("The model must have fixed image dimensions.")

    return tf.image.resize(image_array, (height, width)).numpy()


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    image = read_file_as_image(await file.read())
    
    img_batch = np.expand_dims(image, 0)
    predictions = MODEL.predict(img_batch, verbose=0)

    index = int(np.argmax(predictions[0]))
    predicted_class = CLASS_NAMES[index]
    confidence = float(np.max(predictions[0]))
    return {"class": predicted_class, "confidence": confidence}

if __name__ == "__main__":
    uvicorn.run(app, host="localhost", port=8000)
