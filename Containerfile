FROM docker.io/node:24-slim AS fe-builder

WORKDIR /app

COPY /frontend/package.json /frontend/yarn.lock .

RUN yarn install --frozen-lockfile

COPY /frontend .

RUN yarn build

FROM ghcr.io/astral-sh/uv:python3.11-bookworm

# Sync the project into a new environment, asserting the lockfile is up to date
WORKDIR /app
COPY ./resources/linkerd-await-v0.2.9-amd64 /linkerd-await
COPY pyproject.toml uv.lock .python-version .
RUN uv sync --locked

# Copy the project into the image
ADD . .

COPY --from=fe-builder /app/dist /app/frontend/dist

ARG VERSION
ENV VERSION=${VERSION}

CMD ["uv", "run", "fastapi", "run"]
