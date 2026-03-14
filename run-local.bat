@echo off
cd /d "%~dp0"
start "" http://127.0.0.1:8000/
"C:\Users\asus\AppData\Local\Programs\Python\Python314\python.exe" -m http.server 8000 --bind 127.0.0.1
