# Local/CI fixture only. The historical community image is no longer public.
# Source: official RELEASE.2025-09-07T16-13-09Z, peeled Git commit below.
FROM golang:1.24.13-alpine3.23@sha256:8bee1901f1e530bfb4a7850aa7a479d17ae3a18beb6e09064ed54cfd245b7191 AS build
ENV CGO_ENABLED=0 GOTOOLCHAIN=local GOMAXPROCS=2
WORKDIR /src
ADD --checksum=sha256:8819e3e7817e46b7b3798f8f200ead208562e571563c2e040352378031abe9f2 https://codeload.github.com/minio/minio/tar.gz/07c3a429bfed433e49018cb0f78a52145d4bedeb /tmp/minio-source.tar.gz
RUN tar -xzf /tmp/minio-source.tar.gz --strip-components=1
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    go build -mod=readonly -trimpath -buildvcs=false -p=2 \
    -ldflags='-s -w -X github.com/minio/minio/cmd.Version=2025-09-07T16:13:09Z -X github.com/minio/minio/cmd.ReleaseTag=RELEASE.2025-09-07T16-13-09Z.calas-local -X github.com/minio/minio/cmd.CommitID=07c3a429bfed433e49018cb0f78a52145d4bedeb -X github.com/minio/minio/cmd.ShortCommitID=07c3a429bfed -X github.com/minio/minio/cmd.CopyrightYear=2025' \
    -o /out/minio .

FROM alpine:3.24.3@sha256:be2656061b536c1883c4034790e21d0a09c5aaaf51968b89368a3c0371ea2c9a
LABEL org.opencontainers.image.title="Calas local MinIO fixture" \
      org.opencontainers.image.source="https://github.com/minio/minio" \
      org.opencontainers.image.revision="07c3a429bfed433e49018cb0f78a52145d4bedeb" \
      org.opencontainers.image.version="RELEASE.2025-09-07T16-13-09Z.calas-local" \
      org.opencontainers.image.licenses="AGPL-3.0-or-later"
COPY --from=build /out/minio /usr/local/bin/minio
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=build /src/LICENSE /usr/share/minio-source/LICENSE
COPY --from=build /tmp/minio-source.tar.gz /usr/share/minio-source/source.tar.gz
COPY Dockerfile /usr/share/minio-source/Dockerfile
RUN mkdir -p /data
EXPOSE 9000 9001
HEALTHCHECK --interval=3s --timeout=2s --start-period=5s --retries=30 \
    CMD wget -q -O /dev/null http://127.0.0.1:9000/minio/health/ready || exit 1
ENTRYPOINT ["/usr/local/bin/minio"]
CMD ["server", "/data", "--console-address", ":9001"]
