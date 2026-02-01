# Dockerfile for Doula Cooperative CI builds
# Includes tools for Hugo, Angular, Firebase, and Playwright E2E testing
FROM ubuntu:22.04

# Avoid prompts from apt
ENV DEBIAN_FRONTEND=noninteractive

# Set versions for our tools as arguments
ARG HUGO_VERSION=0.154.2
ARG DART_SASS_VERSION=1.97.2
ARG BUN_VERSION=1.3.5
ARG PLAYWRIGHT_VERSION=1.58.1

# 1. Install base dependencies and Java 21 (required for Firebase emulators - firebase-tools requires Java 21+)
RUN apt-get update && apt-get install -y --no-install-recommends \
  curl \
  wget \
  ca-certificates \
  unzip \
  git \
  openjdk-21-jre-headless \
  && rm -rf /var/lib/apt/lists/*

# Set JAVA_HOME for Firebase emulators
ENV JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
ENV PATH="${JAVA_HOME}/bin:${PATH}"

# Configure git to trust the workspace directory to avoid ownership errors in GitHub Actions
RUN git config --global --add safe.directory /__w/doula-cooperative/doula-cooperative && \
  git config --system --add safe.directory /__w/doula-cooperative/doula-cooperative && \
  git config --system --add core.quotepath false

# Install Node.js 22.x (required by Firebase Functions)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
  && apt-get install -y nodejs

# 2. Install Bun
RUN curl -fsSL https://bun.com/install | bash -s "bun-v${BUN_VERSION}"
ENV PATH="/root/.bun/bin:$PATH"

# 3. Install Hugo (Extended Version)
RUN wget "https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_linux-amd64.deb" \
  && apt-get install -y ./hugo_extended_${HUGO_VERSION}_linux-amd64.deb \
  && rm hugo_extended_${HUGO_VERSION}_linux-amd64.deb

# 4. Install Dart Sass
RUN wget "https://github.com/sass/dart-sass/releases/download/${DART_SASS_VERSION}/dart-sass-${DART_SASS_VERSION}-linux-x64.tar.gz" \
  && tar -xzf "dart-sass-${DART_SASS_VERSION}-linux-x64.tar.gz" \
  && mv dart-sass /usr/local/share/ \
  && ln -s /usr/local/share/dart-sass/sass /usr/local/bin/sass \
  && rm "dart-sass-${DART_SASS_VERSION}-linux-x64.tar.gz"

# 5. Install Playwright with Chromium browser and dependencies
# Use a fixed path for browsers to avoid HOME directory issues in GitHub Actions
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers
RUN bunx playwright@${PLAYWRIGHT_VERSION} install chromium --with-deps

# 6. Verify installations
RUN echo "Bun version: $(bun --version)"
RUN echo "Hugo version: $(hugo version)"
RUN echo "Sass version: $(sass --version)"
RUN echo "Node.js version: $(node --version)"
RUN echo "Java version:" && java -version
RUN echo "JAVA_HOME: ${JAVA_HOME}"
RUN bunx playwright@${PLAYWRIGHT_VERSION} --version

# Set the working directory for when the container starts
WORKDIR /workspace
