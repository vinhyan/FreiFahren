from telegram_bots.config import DEV_CHAT_ID, BACKEND_URL, NLP_BOT_URL
from telegram_bots.bot_utils import send_message
from telegram_bots.watcher.healthcheck import check_backend_status, do_healthcheck, check_nlp_bot_status
from telegram_bots.watcher.app import watcher_app, handle_nlp_bot_error
from telegram_bots.watcher.bot import watcher_bot, start_bot
from telegram_bots import logger

import threading
import time
import subprocess

logger = logger.setup_logger()

def read_output(pipe, callback):
    for line in iter(pipe.readline, ''):
        callback(line.strip())

def start_nlp_bot_process():
    logger.info('Starting the NLP bot process...')
    
    nlp_bot_process = subprocess.Popen(['python3', '-m', 'telegram_bots.FreiFahren_BE_NLP.main'], 
                                       stdout=subprocess.PIPE, 
                                       stderr=subprocess.PIPE,
                                       bufsize=1,
                                       universal_newlines=True)
    
    # Create threads to read both stdout and stderr
    stdout_thread = threading.Thread(target=read_output, args=(nlp_bot_process.stdout, print))
    stderr_thread = threading.Thread(target=read_output, args=(nlp_bot_process.stderr, handle_nlp_bot_error))
    
    stdout_thread.start()
    stderr_thread.start()
    
    # Monitor the process
    while True:
        exit_code = nlp_bot_process.poll()
        if exit_code is not None:
            error_message = f"NLP bot process has exited with code {exit_code}. Please check the logs."
            handle_nlp_bot_error(error_message)
            if exit_code != 0:
                # Read any remaining output from stderr
                stderr_output, _ = nlp_bot_process.communicate()
                if stderr_output:
                    handle_nlp_bot_error(stderr_output)
            break
        
        time.sleep(1)  # Check every second

    # Wait for output reading threads to finish
    stdout_thread.join()
    stderr_thread.join()

def start_watcher_threads():
    logger.info('Starting the watcher threads...')

    nlp_bot_thread = threading.Thread(target=start_nlp_bot_process)
    watcher_bot_thread = threading.Thread(target=start_bot)

    backend_health_thread = threading.Thread(target=check_backend_status)
    nlp_bot_health_thread = threading.Thread(target=check_nlp_bot_status)

    logger.debug('NLP bot thread started')

    nlp_bot_thread.start()
    watcher_bot_thread.start()

    backend_health_thread.start()
    nlp_bot_health_thread.start()


if __name__ == '__main__':
    logger.info('Starting the watcher bot...')

    @watcher_bot.message_handler(commands=['checkhealth'])
    def healthcheck(message):
        send_message(message.chat.id, 'Checking the backend health...', watcher_bot)

        backend_errlist, request_time = do_healthcheck(BACKEND_URL)
        if backend_errlist:
            send_message(message.chat.id, f'Backend is not healthy!\nPlease check the logs for more information. \nThe request took {request_time * 1000} milliseconds and failed with: {backend_errlist}.', watcher_bot)
        else:
            send_message(message.chat.id, f'Backend is healthy!\nThe request took {request_time * 1000} milliseconds.', watcher_bot)

        send_message(message.chat.id, 'Checking the NLP bot health...', watcher_bot)
        
        nlp_errlist, request_time = do_healthcheck(NLP_BOT_URL + '/healthcheck')
        if nlp_errlist:
            send_message(message.chat.id, f'NLP bot is not healthy!\nPlease check the logs for more information.\nThe request took {request_time * 1000} milliseconds and failed with: {nlp_errlist}.', watcher_bot)
        else:
            send_message(message.chat.id, f'NLP bot is healthy!\n The request took {request_time * 1000} milliseconds.', watcher_bot)
    
    start_watcher_threads()
    logger.info("Waitress serve WATCHER_BOT")
        
    from waitress import serve
    serve(watcher_app, host='0.0.0.0', port=6000)
    

    