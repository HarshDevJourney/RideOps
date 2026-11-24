.PHONY: backend frontend typecheck docker
backend:    ; cd backend && uvicorn app.main:app --reload --port 8000
frontend:   ; cd frontend && npm run dev
typecheck:  ; cd frontend && npm run typecheck
docker:     ; docker compose up --build
