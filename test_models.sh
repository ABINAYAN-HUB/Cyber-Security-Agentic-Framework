#!/bin/bash
API_KEY="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"
models=$(curl -s -H "Authorization: Bearer $API_KEY" "https://integrate.api.nvidia.com/v1/models" | jq -r '.data[].id')
found_first=false
for model in $models; do
  if [ "$found_first" = false ]; then
    if [ "$model" = "google/diffusiongemma-26b-a4b-it" ]; then
      found_first=true
    fi
    continue
  fi
  echo -n "Testing $model ... "
  res=$(curl -m 5 -s -o /dev/null -w "%{http_code}" -X POST "https://integrate.api.nvidia.com/v1/chat/completions" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{ "model": "'"$model"'", "messages": [{"role":"user","content":"Hi"}], "max_tokens": 10 }')
  echo "$res"
  if [ "$res" = "200" ]; then
    echo "WORKING_MODEL=$model"
    break
  fi
done
