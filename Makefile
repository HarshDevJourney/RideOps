.PHONY: backend frontend test typecheck docker docker-test
backend:    ; cd backend && uvicorn app.main:app --reload --port 8000
frontend:   ; cd frontend && npm run dev
test:       ; cd backend && python -m pytest -q
typecheck:  ; cd frontend && npm run typecheck
docker:     ; docker compose up --build
docker-test:; docker compose --profile test run --rm tests
