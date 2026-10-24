#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/vedha/Vedha/App/digital-twin-validation-platform"
cd "$ROOT"

echo "Applying production configuration..."

python3 - <<'PY'
from pathlib import Path
p = Path("backend/requirements.txt")
text = p.read_text()
dep = 'psycopg[binary]>=3.2,<4'
if dep not in text:
    if not text.endswith("\n"):
        text += "\n"
    text += dep + "\n"
p.write_text(text)
print("Updated backend/requirements.txt")
PY

cat > backend/app/database.py <<'EOF'
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./digital_twin.db")

if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgresql://",
        "postgresql+psycopg://",
        1,
    )

connect_args = {}

if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
EOF

python3 - <<'PY'
from pathlib import Path

p = Path("backend/app/main.py")
s = p.read_text()

if not s.startswith("import os\n"):
    s = "import os\n" + s

old = '''app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)'''

new = '''frontend_origin = os.getenv("FRONTEND_ORIGIN", "").strip()

allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

if frontend_origin:
    allowed_origins.append(frontend_origin.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)'''

if old in s:
    s = s.replace(old, new)
elif "frontend_origin = os.getenv" not in s:
    raise SystemExit("ERROR: Existing CORS block not found")

p.write_text(s)
print("Updated backend/app/main.py")
PY

python3 - <<'PY'
from pathlib import Path

p = Path("frontend/src/api.js")
s = p.read_text()

old = 'const API_BASE = "http://127.0.0.1:8000";'
new = '''const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";'''

if old in s:
    s = s.replace(old, new)
elif "import.meta.env.VITE_API_BASE_URL" not in s:
    raise SystemExit("ERROR: API base URL line not found")

p.write_text(s)
print("Updated frontend/src/api.js")
PY

cat > frontend/.env.example <<'EOF'
VITE_API_BASE_URL=http://127.0.0.1:8000
EOF

cat > backend/.env.example <<'EOF'
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
FRONTEND_ORIGIN=https://your-frontend.onrender.com
EOF

cat > render.yaml <<'EOF'
services:
  - type: web
    name: digital-twin-validation-api
    runtime: python
    rootDir: backend
    plan: free
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
    healthCheckPath: /health
    autoDeploy: true
    envVars:
      - key: PYTHON_VERSION
        value: 3.13.15
      - key: DATABASE_URL
        sync: false
      - key: FRONTEND_ORIGIN
        sync: false

  - type: web
    name: digital-twin-validation-platform
    runtime: static
    rootDir: frontend
    buildCommand: npm install && npm run build
    staticPublishPath: ./dist
    autoDeploy: true
    envVars:
      - key: VITE_API_BASE_URL
        sync: false
EOF

cat >> .gitignore <<'EOF'

# Local databases
*.db

# Environment files
.env
backend/.env
frontend/.env

# Development backups
*.backup
*.before-api
*.before-fastapi
*.before-live-backend
*.pre-api.backup
*.pre-domain.backup
EOF

echo
echo "SUCCESS: Production configuration applied."
