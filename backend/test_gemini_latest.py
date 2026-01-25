"""
Test gemini models.
"""
import google.generativeai as genai

# Configure with API key
api_key = "oof"
genai.configure(api_key=api_key)

print("Testing gemini-2.5-pro:")
try:
    model = genai.GenerativeModel('gemini-2.5-pro')
    response = model.generate_content("Say hello in one sentence")
    print(f"✓ Success: {response.text}")
except Exception as e:
    print(f"✗ Error: {e}")


