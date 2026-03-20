.PHONY: install dev check test build seed docker-build docker-run docker-stop docker-logs clean

# ローカル開発
install:
	NODE_ENV=development npm install

dev:
	NODE_ENV=development npm run dev -- --port 3000

check:
	NODE_ENV=development npm run check

test:
	NODE_ENV=development npx vitest run

build:
	npm run build

seed:
	@mkdir -p /tmp/oremedi-media/{movies,live,voice,music} /tmp/oremedi-converted data
	npx tsx scripts/seed.ts

# Docker
docker-build:
	docker build -t oremedi .

docker-run:
	@mkdir -p /tmp/oremedi-media /tmp/oremedi-converted data
	docker run --rm -d --name oremedi \
		-p 3000:3000 \
		--env-file .env \
		-v /tmp/oremedi-media:/media:ro \
		-v /tmp/oremedi-converted:/media-converted \
		-v $(PWD)/data:/data \
		oremedi
	@echo "http://localhost:3000 で起動"

docker-stop:
	docker stop oremedi

docker-logs:
	docker logs -f oremedi

# クリーンアップ
clean:
	rm -rf node_modules build .svelte-kit
