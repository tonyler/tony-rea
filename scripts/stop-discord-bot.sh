#!/bin/bash

# Stop Discord Bot Script
# This script stops the Discord knowledge bot

echo "Stopping Discord Knowledge Bot..."

# Find and kill the process
pkill -f "discord-bot" || true
pkill -f "tony-rea-discord-bot" || true

echo "Discord bot stopped"
