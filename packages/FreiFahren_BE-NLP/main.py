import os
import telebot
import pytz
from datetime import datetime
from dotenv import load_dotenv
from verify_info import verify_direction, verify_line
from process_message import (
    find_line,
    find_direction,
    find_station,
    format_text,
    lines_with_stations,
    load_data,
    check_for_spam
)
from db_utils import create_table_if_not_exists, insert_ticket_info
from app import app
from logging_utils import setup_logger
import traceback
import requests
import sys
import threading
sys.path.append('..')
from watcher.config import DEV_CHAT_ID
class TicketInspector:
    def __init__(self, line, station, direction):
        self.line = line
        self.station = station
        self.direction = direction


def extract_ticket_inspector_info(unformatted_text):
    # Initial guards to avoid unnecessary processing
    if '?' in unformatted_text or check_for_spam(unformatted_text):
        ticket_inspector = TicketInspector(line=None, station=None, direction=None)
        logger.info('Message is not getting processed')
        return ticket_inspector.__dict__

    found_line = find_line(unformatted_text, lines_with_stations)
    ticket_inspector = TicketInspector(line=found_line, station=None, direction=None)

    # Get the direction
    text = format_text(unformatted_text)
    found_direction = find_direction(text, ticket_inspector)[0]
    ticket_inspector.direction = found_direction

    # Pass the text without direction to avoid finding the direction again
    text_without_direction = find_direction(text, ticket_inspector)[1]
    found_station = find_station(text_without_direction, ticket_inspector)
    ticket_inspector.station = found_station

    # With the found info we can cross check the direction and line
    if found_line or found_station or found_direction:
        verify_direction(ticket_inspector, text)
        verify_line(ticket_inspector, text)

        return ticket_inspector.__dict__
    else:
        return None


stations_dict = load_data('data/stations_list_main.json')


def process_new_message(timestamp, message):
    info = extract_ticket_inspector_info(message.text)
    if (type(info) is dict):
        found_items = []
        if info.get('line'):
            found_items.append('line')
        if info.get('station'):
            found_items.append('station')
        if info.get('direction'):
            found_items.append('direction')
        
        # Avoid logging the actual data to avoid storing data with which the user could be identified
        if found_items:
            logger.info('Found Info: %s', ', '.join(found_items))

            insert_ticket_info(
                timestamp,
                info.get('line'),
                info.get('station'),
                info.get('direction'),
            )
    else:
        logger.info('No line, station or direction found in the message')


def handle_exception(exc_type, exc_value, exc_traceback):
    """Handle uncaught exceptions by sending a POST request with exception info."""
    error_message = "".join(traceback.format_exception(exc_type, exc_value, exc_traceback))
    requests.post(WATCHER_URL, json={"error_message": error_message})
    logger.error('Unhandled exception', exc_info=(exc_type, exc_value, exc_traceback))
    
def start_bot():
    bot.infinity_polling()

if __name__ == '__main__':
    logger = setup_logger()

    sys.excepthook = handle_exception
    
    load_dotenv()
    BOT_TOKEN = os.getenv('BOT_TOKEN')
    BACKEND_URL = os.getenv('BACKEND_URL')
   
    utc = pytz.UTC
    
    bot = telebot.TeleBot(BOT_TOKEN)

    create_table_if_not_exists()

    logger.info('Bot is running...')

    @bot.message_handler(func=lambda message: message)
    def get_info(message):
        logger.info('------------------------')
        timestamp = datetime.fromtimestamp(message.date, utc)
        # Round the timestamp to the last minute
        timestamp = timestamp.replace(second=0, microsecond=0)
            
        process_new_message(timestamp, message)
        
        logger.info('------------------------')
        logger.info('MESSAGE RECEIVED')
        timestamp = datetime.fromtimestamp(message.date, utc)
        
        # Round the timestamp to the last minute
        timestamp = timestamp.replace(second=0, microsecond=0)
            
        process_new_message(timestamp, message)

    bot_thread = threading.Thread(target=start_bot)

    bot_thread.start()
    
    app.run(port=5001)
