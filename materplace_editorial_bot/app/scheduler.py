from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
from .config import Settings
from .main import main

def run_scheduler():
    settings=Settings(); settings.validate(); scheduler=BlockingScheduler(timezone=settings.timezone)
    for hour in (6,12,18): scheduler.add_job(main,CronTrigger(hour=hour,minute=0,timezone=settings.timezone),id=f"editorial-{hour}",replace_existing=True,max_instances=1,coalesce=True)
    scheduler.start()
if __name__=="__main__":run_scheduler()
