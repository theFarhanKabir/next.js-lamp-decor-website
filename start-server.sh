#!/bin/bash
cd "$(dirname "$0")"
npx http-server dist -p 5210 -a 127.0.0.1 -c-1 --cors &
sleep 2
echo "Server started on port 5210"
