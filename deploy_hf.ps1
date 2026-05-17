# Deploy to Hugging Face Space (run from repo root after: hf auth login)
$Space = "himanshau/shl-assessment-recommender"

Write-Host "Creating Space (skip if exists)..."
hf repo create $Space --type space --space-sdk docker --flavor cpu-basic --public --exist-ok

Write-Host "Uploading files (may take several minutes)..."
hf upload $Space . . --repo-type space

Write-Host ""
Write-Host "Done. Add secrets in HF Settings:"
Write-Host "  GROQ_API_KEY"
Write-Host "  DEEPGRAM_API_KEY"
Write-Host ""
Write-Host "Live URL: https://himanshau-shl-assessment-recommender.hf.space"
