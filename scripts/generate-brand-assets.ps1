$srcImg = "public\brand\logo.jpg"

if (-not (Test-Path $srcImg)) {
    $srcImg = "C:\Users\Dyveto\.gemini\antigravity\brain\b314c3f8-def4-417a-9efa-3a8a12064e3c\.user_uploaded\media_1795295716747_bcc9d35e.jpg"
}

Add-Type -AssemblyName System.Drawing

$srcBmp = [System.Drawing.Bitmap]::FromFile((Resolve-Path $srcImg).Path)

# El símbolo F está centrado en 1024x1024.
# Un recorte de 640x640 centrado (x: 192, y: 192) mantiene un margen limpio de ~85px
# de fondo azul marino alrededor de la billetera y la flecha, evitando cualquier corte a ras.
$cropX = 192
$cropY = 192
$cropSize = 640
$cropRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropSize, $cropSize)

function Save-Cropped-Resized($targetPath, $width, $height, $format) {
    $destBmp = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    
    $destRect = New-Object System.Drawing.Rectangle(0, 0, $width, $height)
    $g.DrawImage($srcBmp, $destRect, $cropRect, [System.Drawing.GraphicsUnit]::Pixel)
    
    $destBmp.Save($targetPath, $format)
    $g.Dispose()
    $destBmp.Dispose()
}

Save-Cropped-Resized "public\brand\app-icon-cropped.png" 512 512 ([System.Drawing.Imaging.ImageFormat]::Png)
Save-Cropped-Resized "public\icon-192.png" 192 192 ([System.Drawing.Imaging.ImageFormat]::Png)
Save-Cropped-Resized "public\icon-512.png" 512 512 ([System.Drawing.Imaging.ImageFormat]::Png)
Save-Cropped-Resized "public\apple-touch-icon.png" 180 180 ([System.Drawing.Imaging.ImageFormat]::Png)
Save-Cropped-Resized "public\favicon-32x32.png" 32 32 ([System.Drawing.Imaging.ImageFormat]::Png)
Save-Cropped-Resized "public\favicon-16x16.png" 16 16 ([System.Drawing.Imaging.ImageFormat]::Png)
Save-Cropped-Resized "public\favicon.ico" 32 32 ([System.Drawing.Imaging.ImageFormat]::Icon)
Save-Cropped-Resized "src\app\icon.png" 192 192 ([System.Drawing.Imaging.ImageFormat]::Png)
Save-Cropped-Resized "src\app\apple-icon.png" 180 180 ([System.Drawing.Imaging.ImageFormat]::Png)

$srcBmp.Dispose()

Write-Output "Successfully generated zoomed, cropped brand icons and favicons."
