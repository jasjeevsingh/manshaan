"""
Test Gemini API to debug the error.
"""
import google.generativeai as genai
import os

# Configure with API key
api_key = "AIzaSyB5zFutu9m5zcbLJ_hKatqfwpPaMdvrLh0"
genai.configure(api_key=api_key)

print("Testing Gemini API...")
print(f"API Key configured: {api_key[:10]}...")

# List available models
print("\nAvailable models:")
for model in genai.list_models():
    if 'generateContent' in model.supported_generation_methods:
        print(f"  - {model.name}")

# Try gemini-pro
print("\nTesting gemini-pro:")
try:
    model = genai.GenerativeModel('gemini-pro')
    response = model.generate_content("Say hello")
    print(f"✓ Success: {response.text}")
except Exception as e:
    print(f"✗ Error: {e}")

# Try models/gemini-pro
print("\nTesting models/gemini-pro:")
try:
    model = genai.GenerativeModel('models/gemini-pro')
    response = model.generate_content("Say hello")
    print(f"✓ Success: {response.text}")
except Exception as e:
    print(f"✗ Error: {e}")
