from fastapi import FastAPI

app = FastAPI(
    title="Digital Twin Engineering Validation API",
    version="0.1.0",
    description=(
        "Backend API for BOM, revision, lifecycle, PLM synchronization, "
        "validation, and defect-management workflows."
    ),
)


@app.get("/")
def root():
    return {
        "name": "Digital Twin Engineering Validation Platform",
        "status": "active-development",
        "version": "0.1.0",
    }


@app.get("/health")
def health():
    return {"status": "ok"}
