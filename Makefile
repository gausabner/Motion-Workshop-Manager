.PHONY: help db dev migrate seed studio test-backup backup verify-backup

help:
	@echo "  make db       - start local Postgres (docker compose)"
	@echo "  make dev      - run the Next.js app on :3000"
	@echo "  make migrate  - apply Prisma migrations (dev)"
	@echo "  make seed     - load the TipTop AutoCare demo workshop"
	@echo "  make studio   - open Prisma Studio"
	@echo ""
	@echo "  make test-backup   - exercise the off-site backup scripts"
	@echo "  make backup        - take an off-site backup now"
	@echo "  make verify-backup - restore the latest backup and check it"

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

test-backup:
	bash ops/backup/s3.test.sh
	bash ops/backup/rotate.test.sh
	bash ops/backup/crypt.test.sh
	bash ops/backup/e2e.test.sh

backup:
	ops/backup/motion-backup.sh

verify-backup:
	ops/backup/motion-verify.sh
