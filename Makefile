.PHONY: run test docker docker-test
run:        ; uvicorn app.main:app --reload
test:       ; python -m pytest -q
docker:     ; docker compose up --build
docker-test:; docker compose --profile test run --rm tests
