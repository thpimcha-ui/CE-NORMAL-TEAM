Add-Type -AssemblyName System.Drawing
$iconDir = Join-Path $PSScriptRoot '../public/icons'
New-Item -ItemType Directory -Path $iconDir -Force | Out-Null
foreach ($size in @(192,512)) {
    $bitmap = [System.Drawing.Bitmap]::new($size,$size)
    $g = [System.Drawing.Graphics]::FromImage($bitmap)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear([System.Drawing.ColorTranslator]::FromHtml('#0b1014'))
    $g.ScaleTransform($size/512.0,$size/512.0)
    $rect = [System.Drawing.Rectangle]::new(78,78,356,356)
    $gold = [System.Drawing.Drawing2D.LinearGradientBrush]::new($rect,[System.Drawing.ColorTranslator]::FromHtml('#fff2a1'),[System.Drawing.ColorTranslator]::FromHtml('#a66a17'),45.0)
    $g.FillEllipse($gold,$rect)
    $edge = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#ffe9a0'),3)
    $g.DrawEllipse($edge,83,83,346,346)
    $inside = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#3d2b14'))
    $g.FillEllipse($inside,104,104,304,304)
    $g.DrawEllipse($edge,112,112,288,288)
    $font = [System.Drawing.Font]::new('Segoe UI',230,[System.Drawing.FontStyle]::Bold,[System.Drawing.GraphicsUnit]::Pixel)
    $format = [System.Drawing.StringFormat]::new()
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $g.DrawString('P',$font,$gold,[System.Drawing.RectangleF]::new(100,93,312,316),$format)
    $bitmap.Save((Join-Path $iconDir "icon-$size.png"),[System.Drawing.Imaging.ImageFormat]::Png)
    $format.Dispose();$font.Dispose();$inside.Dispose();$edge.Dispose();$gold.Dispose();$g.Dispose();$bitmap.Dispose()
}
