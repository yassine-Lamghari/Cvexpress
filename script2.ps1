
$content = Get-Content api/templates/one_and_half_column.tex -Raw
$content = $content -replace "\\vspace\{0.5mm\}", "\vspace{1mm}"
Set-Content api/templates/one_and_half_column.tex $content

