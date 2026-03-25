
$content = Get-Content api/templates/one_and_half_column.tex -Raw
$content = $content -replace '\\newcommand\{\\cvitem\}\[2\]\{(\s*\%.*?\s*)*\\noindent\\begin\{minipage\}\[t\]\{\\cvleftcolumnwidth\}(.|\s)*?\\vspace\{\\cvafteritemskipamount\}\s*\}', "\\newcommand{\\cvitem}[2]{`n    \\ifx\\relax#1\\relax`n        \\noindent\\begin{minipage}[t]{\\textwidth}`n            \\setlength{\\parskip}{\\cvparskip} #2`n        \\end{minipage}\\par`n    \\else`n        \\noindent\\begin{minipage}[t]{\\cvleftcolumnwidth}`n            \\raggedright #1`n        \\end{minipage}%`n        \\hspace{\\cvcolumngapwidth}%`n        \\begin{minipage}[t]{\\cvrightcolumnwidth}`n            \\setlength{\\parskip}{\\cvparskip} #2`n        \\end{minipage}\\par`n    \\fi`n    \\vspace{\\cvafteritemskipamount}`n}"
Set-Content api/templates/one_and_half_column.tex $content

