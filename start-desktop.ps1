param(
  [string]$Python = "python"
)

& $Python -m pip install -r desktop\requirements.txt
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

& $Python desktop\run.py
