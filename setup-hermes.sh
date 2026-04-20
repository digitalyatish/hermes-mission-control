#!/bin/bash
# ============================================================
# Hermes Agent — automated setup script
# Run this once inside your GitHub Codespace terminal:
#   bash setup-hermes.sh
#
# You will be prompted for your OpenRouter API key.
# Never hardcode API keys in this file.
# ============================================================
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ---- Prompt for secrets (never stored in repo) ----
echo ""
echo -e "${YELLOW}Enter your OpenRouter API key (sk-or-v1-...):${NC}"
read -r OPENROUTER_KEY

if [ -z "$OPENROUTER_KEY" ]; then
  echo "Error: OpenRouter API key is required."
  exit 1
fi

echo -e "${GREEN}=== Step 1/4: Downloading Hermes install script ===${NC}"
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh -o /tmp/hermes-install.sh

echo -e "${GREEN}=== Step 2/4: Installing Hermes (auto-answering prompts) ===${NC}"
printf 'n\nn\nn\nno\n' | bash /tmp/hermes-install.sh

echo -e "${GREEN}=== Step 3/4: Configuring OpenRouter + Mission Control ===${NC}"
export PATH="$HOME/.local/bin:$HOME/.hermes/bin:$PATH"
source ~/.bashrc 2>/dev/null || true

mkdir -p ~/.hermes
cat >> ~/.hermes/.env << ENVEOF

# OpenRouter (added by setup-hermes.sh)
OPENROUTER_API_KEY=${OPENROUTER_KEY}
HERMES_INFERENCE_PROVIDER=openrouter
HERMES_MODEL=nousresearch/hermes-3-llama-3.1-405b
ENVEOF

if [ -f ~/.hermes/cli-config.yaml ]; then
  python3 -c "
import re
with open('$HOME/.hermes/cli-config.yaml', 'r') as f:
    content = f.read()
content = re.sub(r'(default:\s*)\"[^\"]*\"', r'\1\"nousresearch/hermes-3-llama-3.1-405b\"', content, count=1)
content = re.sub(r'(provider:\s*)\"[^\"]*\"', r'\1\"openrouter\"', content, count=1)
with open('$HOME/.hermes/cli-config.yaml', 'w') as f:
    f.write(content)
print('cli-config.yaml updated')
" 2>/dev/null || true
fi

echo -e "${GREEN}=== Step 4/4: Saving Mission Control memory ===${NC}"
sleep 3

if command -v hermes &> /dev/null; then
  hermes remember "My Mission Control API is at https://kuxffnsvojgxxqezscqh.supabase.co/functions/v1/hermes-api — always include header X-API-Key: c6e30c44b7911715b4924a1bbfd7af029dc0342acd2746c49b78b8f48436de43 when calling it. This API has 109 actions for meetings, outreach, leads, skills, memory, and agent activity."
  echo ""
  echo -e "${GREEN}✅ All done! Hermes is ready.${NC}"
  echo -e "${YELLOW}Try it:${NC}  hermes \"What can you do?\""
else
  echo ""
  echo -e "${YELLOW}Hermes installed. Run: source ~/.bashrc && hermes \"What can you do?\"${NC}"
fi
