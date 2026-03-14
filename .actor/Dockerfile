# Specify the base Docker image.
FROM apify/actor-node-puppeteer-chrome:20 AS intermediate

# Check preinstalled packages
RUN npm ls crawlee apify puppeteer playwright

# Copy just package.json and package-lock.json
COPY --chown=myuser package*.json ./

# Install all dependencies. Don't audit to speed up the installation.
RUN npm install --include=dev --audit=false

# Copy the source files using the user set in the base image.
COPY --chown=myuser . ./

# Create final image
FROM apify/actor-node-puppeteer-chrome:20

# Check preinstalled packages
RUN npm ls crawlee apify puppeteer playwright

# Copy just package.json and package-lock.json
COPY --chown=myuser package*.json ./

# Install ONLY production dependencies
RUN npm --quiet set progress=false \
    && npm install --omit=dev --omit=optional \
    && echo "Installed NPM packages:" \
    && (npm list --omit=dev --all || true) \
    && echo "Node.js version:" \
    && node --version \
    && echo "NPM version:" \
    && npm --version \
    && rm -r ~/.npm

# Copy the remaining files and directories with the source code.
COPY --chown=myuser . ./

# Run the image.
CMD ./start_xvfb_and_run_cmd.sh && npm run start:prod --silent
