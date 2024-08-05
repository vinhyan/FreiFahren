import os
from dotenv import load_dotenv


load_dotenv()

WATCHER_BOT_TOKEN = os.getenv('WATCHER_BOT_TOKEN')
DEV_CHAT_ID = os.getenv('DEV_CHAT_ID')

FREIFAHREN_CHAT_ID = os.getenv('FREIFAHREN_CHAT_ID')
NLP_BOT_TOKEN = os.getenv('NLP_BOT_TOKEN')

TELEGERAM_BOTS_URL = os.getenv('TELEGERAM_BOTS_URL')
BACKEND_URL = os.getenv('BACKEND_URL')

TELEGRAM_NEXT_CHECK_TIME = 60
TELEGRAM_NEXT_CHECK_TIME_CORRECT = 60*20
TELEGRAM_TIMEOUT = 5
