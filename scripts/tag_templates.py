import os
import shutil
import zipfile
import re
import xml.etree.ElementTree as ET

TEMPLATES_DIR = r"public\files\document-templates"
ORIGINALS_DIR = os.path.join(TEMPLATES_DIR, "originals")

os.makedirs(ORIGINALS_DIR, exist_ok=True)

# 1. Back up originals
for f in os.listdir(TEMPLATES_DIR):
    if f.endswith(".docx") and os.path.isfile(os.path.join(TEMPLATES_DIR, f)):
        src = os.path.join(TEMPLATES_DIR, f)
        dst = os.path.join(ORIGINALS_DIR, f)
        if not os.path.exists(dst):
            shutil.copy2(src, dst)
            print(f"Backed up {f} to originals/")

print("Backups ready.")
