$srcImg1 = "C:\Users\Dyveto\.gemini\antigravity\brain\b314c3f8-def4-417a-9efa-3a8a12064e3c\.user_uploaded\media_1795295716747_bcc9d35e.jpg"
$srcImg2 = "C:\Users\Dyveto\.gemini\antigravity\brain\b314c3f8-def4-417a-9efa-3a8a12064e3c\.user_uploaded\media_1795295709461_d48506fd.jpg"

if (-not (Test-Path "public\brand")) {
    New-Item -ItemType Directory -Force -Path "public\brand" | Out-Null
}

Copy-Item $srcImg1 -Destination "public\brand\logo.jpg" -Force
Copy-Item $srcImg2 -Destination "public\brand\app-icon.jpg" -Force

Add-Type -AssemblyName System.Drawing

function Resize-Image($sourcePath, $targetPath, $width, $height, $format) {
    $srcBmp = [System.Drawing.Bitmap]::FromFile($sourcePath)
    $destBmp = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.DrawImage($srcBmp, 0, 0, $width, $height)
    $destBmp.Save($targetPath, $format)
    $g.Dispose()
    $destBmp.Dispose()
    $srcBmp.Dispose()
}

Resize-Image $srcImg2 "public\icon-192.png" 192 192 ([System.Drawing.Imaging.ImageFormat]::Png)
Resize-Image $srcImg2 "public\icon-512.png" 512 512 ([System.Drawing.Imaging.ImageFormat]::Png)
Resize-Image $srcImg2 "public\apple-touch-icon.png" 180 180 ([System.Drawing.Imaging.ImageFormat]::Png)
Resize-Image $srcImg2 "public\favicon-32x32.png" 32 32 ([System.Drawing.Imaging.ImageFormat]::Png)
Resize-Image $srcImg2 "public\favicon-16x16.png" 16 16 ([System.Drawing.Imaging.ImageFormat]::Png)
Resize-Image $srcImg2 "public\favicon.ico" 32 32 ([System.Drawing.Imaging.ImageFormat]::Icon)
Resize-Image $srcImg2 "src\app\icon.png" 192 192 ([System.Drawing.Imaging.ImageFormat]::Png)
Resize-Image $srcImg2 "src\app\apple-icon.png" 180 180 ([System.Drawing.Imaging.ImageFormat]::Png)

Write-Output "Brand assets generated successfully."
