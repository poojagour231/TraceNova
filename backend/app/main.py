from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from . import models
from .routes.cases import router as cases_router 
from .routes.evidence import router as evidence_router
from .routes.analysis import router as analysis_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="TraceNova",
    description="AI-Powered Unified Cyber Fraud Analysis & Digital Artifact Correlator",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "https://tracenova-web.vercel.app",
        "https://cyberscam.netlify.app",

    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cases_router) 
app.include_router(evidence_router)
app.include_router(analysis_router)


@app.get("/")
def root():
    return {
        "message": "TraceNova API is running"
    }