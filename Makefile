.PHONY: help db dev migrate seed studio

help:
	@echo "  make db       - start local Postgres (docker compose)"
	@echo "  make dev      - run the Next.js app on :3000"
	@echo "  make migrate  - apply Prisma migrations (dev)"
	@echo "  make seed     - load the TipTop AutoCare demo workshop"
	@echo "  make studio   - open Prisma Studio"

db:
	docker compose up -d db

dev:
	cd web && npm run dev

migrate:
	cd web && npm run db:migrate

seed:
	cd web && npm run db:seed

studio:
	cd web && npm run db:studio
