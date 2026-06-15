import os
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime, timedelta
import threading

class ThreadLogFilter(logging.Filter):
    """
    This filter only show log entries for specified thread name
    """
    def __init__(self, thread_name, *args, **kwargs):
        logging.Filter.__init__(self, *args, **kwargs)
        self.thread_name = thread_name

    def filter(self, record):
        return record.threadName == self.thread_name


def initialize(dir, folder, prefix=''):
    folderDirPath = os.path.join(dir, folder)
    if not os.path.exists(folderDirPath):
        os.mkdir(folderDirPath)
    currentDateLogPath = os.path.join(folderDirPath, datetime.now().strftime("%Y-%m-%d"))
    if not os.path.exists(currentDateLogPath):
        os.mkdir(currentDateLogPath)

    tzDT = datetime.now().utcnow() + timedelta(hours=8)
    threadName = threading.Thread.getName(threading.current_thread())
    logFileName = f'{prefix + " - " if prefix else ""}{tzDT.isoformat()}.log'
    logFile = os.path.join(currentDateLogPath, logFileName.replace(":", "_"))
    logFilter = logging.Filter()
    logFormatter = logging.Formatter(fmt="%(asctime)s | %(threadName)-11s | %(levelname)-8s | %(message)s")
    # logHandler = logging.FileHandler(logFile)
    logHandler = RotatingFileHandler(logFile, mode='a', maxBytes=5*1024*1024, backupCount=2, encoding='utf-8', delay=False)
    logHandler.setFormatter(logFormatter)
    logHandler.addFilter(ThreadLogFilter(threadName))
    logHandler.setFormatter(logFormatter)
    logHandler.setLevel(logging.INFO)

    logging.basicConfig(
        datefmt='%Y-%m-%d %H:%M:%S',
        encoding='utf-8',
        level=logging.DEBUG,
        handlers=[logHandler],
    )
    
    return logHandler
    
def initializeThreadLogging(dir, folder, prefix=''):
    """
    Add a log handler to separate file for current thread
    """
    folderDirPath = os.path.join(dir, folder)
    if not os.path.exists(folderDirPath):
        os.mkdir(folderDirPath)
    currentDateLogPath = os.path.join(folderDirPath, datetime.now().strftime("%Y-%m-%d"))
    if not os.path.exists(currentDateLogPath):
        os.mkdir(currentDateLogPath)
    tzDT = datetime.now().utcnow() + timedelta(hours=8)
    
    threadName = threading.Thread.getName(threading.current_thread())
    logFileName = f'{prefix + " - " if prefix else ""}{tzDT.isoformat()}-{threadName}.log'
    logFile = os.path.join(currentDateLogPath, logFileName.replace(":", "_"))
    logHandler = RotatingFileHandler(logFile, mode='a', maxBytes=5*1024*1024, backupCount=2, encoding='utf-8', delay=False)
    logHandler.setLevel(logging.DEBUG)

    formatter = logging.Formatter(
        "%(asctime)-15s"
        "| %(threadName)-11s"
        "| %(levelname)-5s"
        "| %(message)s"
    )
    logHandler.setFormatter(formatter)

    logFilter = ThreadLogFilter(threadName)
    logHandler.addFilter(logFilter)

    logger = logging.getLogger()
    logger.addHandler(logHandler)

    return logHandler

def stopLogHandler(logHandler: RotatingFileHandler):
    logging.getLogger().removeHandler(logHandler)
    logHandler.close()

def logPrint(message: str, level = 20, print_enabled=False) -> None:
    if print_enabled:
        print(message)
    logging.log(level if level else logging.INFO, message)