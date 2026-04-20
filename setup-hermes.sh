#!/bin/bash
# ============================================================
# Hermes Agent — automated setup script
# Run this once inside your GitHub Codespace terminal:
#   bash setup-hermes.sh
# ============================================================
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Step 1/4: Downloading Hermes install script ===${NC}"
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh -o /tmp/hermes-install.sh

echo -e "${GREEN}=== Step 2/4: Installing Hermes (auto-answering prompts) ===${NC}"
# printf feeds answers to interactive prompts:
#   n = skip optional ripgrep/ffmpeg/build-tools installs
#   n = skip background gateway service
#   no = skip WhatsApp pairing
printf 'n\nn\nn\nno\n' | bash /tmp/hermes-install.sh

echo -e "${GREEN}=== Step 3/4: Configuring OpenRouter + Mission Control ===${NC}"

# Reload PATH so hermes binary is found
export PATH="$HOME/.local/bin:$HOME/.hermes/bin:$PATH"
source ~/.bashrc 2>/dev/null || true

# Write API keys to ~/.hermes/.env
mkdir -p ~/.hermes
cat >> ~/.hermes/.env << 'ENVEOF'

# OpenRouter (added by setup-hermes.sh)
OPENROUTER_API_KEY=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
HERMES_INFERENCE_PROVIDER=openrouter
HERMES_MODEL=nousresearch/hermes-3-llama-3.1-405b
ENVEOF

# Write model selection to cli-config.yaml
if [ -f ~/.hermes/cli-config.yaml ]; then
  # Update existing config
  python3 -c "
import re, sys
with open('$HOME/.hermes/cli-config.yaml', 'r') as f:
    content = f.read()
# Update model default if present
content = re.sub(r'(default:\s*)\"[^\"]*\"', r'\1\"nousresearch/hermes-3-llama-3.1-405b\"', content, count=1)
content = re.sub(r'(provider:\s*)\"[^\"]*\"', r'\1\"openrouter\"', content, count=1)
with open('$HOME/.hermes/cli-config.yaml', 'w') as f:
    f.write(content)
print('cli-config.yaml updated')
" 2>/dev/null || echo "Note: cli-config.yaml update skipped (env vars take precedence)"
fi

echo -e "${GREEN}=== Step 4/4: Saving Mission Control memory ===${NC}"

# Wait a moment for hermes to be fully ready
sleep 3

if command -v hermes &> /dev/null; then
  hermes remember "My Mission Control API is at https://kuxffnsvojgxxqezscqh.supabase.co/functions/v1/hermes-api — always include header X-API-Key: c6e30c44b7911715b4924a1bbfd7af029dc0342acd2746c49b78b8f48436de43 when calling it. This API has 109 actions for meetings, outreach, leads, skills, memory, and agent activity. My Supabase project is kuxffnsvojgxxqezscqh.supabase.co."
  echo ""
  echo -e "${GREEN}✅ All done! Hermes is ready.${NC}"
  echo ""
  echo -e "${YELLOW}Try it:${NC}  hermes \"What can you do?\""
else
  echo ""
  echo -e "${YELLOW}⚠️  Hermes installed but not on PATH yet. Run:${NC}"
  echo "  source ~/.bashrc"
  echo "  hermes remember 'My Mission Control API is at https://kuxffnsvojgxxqezscqh.supabase.co/functions/v1/hermes-api — always include header X-API-Key: c6e30c44b7911715b4924a1bbfd7af029dc0342acd2746c49b78b8f48436de43'"
  echo "  hermes \"What can you do?\""
fi
