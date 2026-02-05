# Restart Tony & Rea Server

Restart the application by stopping and starting the server using the scripts in `/scripts`.

## Steps

1. Run the stop script to gracefully shut down any running server:
   ```bash
   ./scripts/stop.sh
   ```

2. Run the start script to start the server:
   ```bash
   ./scripts/start.sh
   ```

3. Verify the server is running by checking the health endpoint:
   ```bash
   ./scripts/health.sh
   ```

4. Report the status to the user, including:
   - Whether the restart was successful
   - The server PID
   - The URL where the server is accessible
