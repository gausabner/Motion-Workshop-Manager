.PHONY: help dev-api dev-web

help:
	@echo "Available commands:"
	@echo "  dev-api    - Run the locally running FastAPI backend"
	@echo "  dev-web    - Run the Next.js development server"

dev-api:
	cd api && uvicorn main:app --reload

dev-web:
	cd web && npm run dev
