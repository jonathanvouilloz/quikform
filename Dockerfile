# Build the single executable, then ship it alone on a minimal image with glibc.
FROM oven/bun:1.4.3 AS build
WORKDIR /src
COPY package.json bun.lock bunfig.toml tsconfig.json ./
RUN bun install --frozen-lockfile
COPY scripts ./scripts
COPY src ./src
RUN bun run build && mkdir /data

FROM gcr.io/distroless/cc-debian12:nonroot
COPY --from=build /src/dist/quikform /usr/local/bin/quikform
COPY --from=build --chown=nonroot:nonroot /data /data
ENV QUIKFORM_HOME=/data
VOLUME /data
EXPOSE 8787
ENTRYPOINT ["quikform"]
# 0.0.0.0 inside the container only; compose.yaml publishes the port on the host's 127.0.0.1.
CMD ["serve", "--host", "0.0.0.0", "--port", "8787"]
