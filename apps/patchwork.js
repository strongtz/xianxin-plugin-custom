import plugin from "../../../lib/plugins/plugin.js";
import xxCfg from "../model/xxCfg.js";
import fs from "node:fs";
import fetch from "node-fetch";
import lodash from 'lodash'

let patchworkSetFile = "./plugins/trss-xianxin-plugin/config/patchwork.set.yaml";

export class patchwork extends plugin {
  constructor() {
    super({
      name: "pw功能",
      dsc: "pw相关指令",
      event: "message",
      priority: 500,
      rule: [
        {
          reg: "^#*手动推送pw$",
          fnc: "newPushTask",
          permission: "master",
          event: "message.group",
        },
      ],
    });
    this.patchworkSetData = xxCfg.getConfig("patchwork", "set");

    /** 定时任务 */
    this.task = {
      cron: !!this.patchworkSetData.pushStatus ?
        this.patchworkSetData.pushTime : "",
      name: "trss-xianxin插件---patchwork推送定时任务",
      fnc: () => this.newPushTask(),
      log: !!this.patchworkSetData.pushTaskLog,
    };
  }

  async getLastRunTime() {
    // 从Redis获取最后运行时间
    let key = `Yz:xianxin:patchwork:lastRunTime`;
    let lastRunTime = await redis.get(key);
    if (!lastRunTime) {
      // 如果Redis中没有记录，则返回当天0点
      let today = new Date().toISOString().slice(0, 10);
      return today + 'T00:00:00';
    }
    return lastRunTime;
  }

  async saveLastRunTime(lastRunTime) {
    // 将最后运行时间字符串转换为Date对象
    let date = new Date(lastRunTime);
    // 加上一秒
    date.setSeconds(date.getSeconds() + 1);
    // 考虑时区差异，加上8小时（8 * 60 * 60 * 1000毫秒）
    date.setTime(date.getTime() + 8 * 60 * 60 * 1000);

    // 手动格式化日期时间字符串（YYYY-MM-DDTHH:MM:SS）
    let year = date.getUTCFullYear();
    let month = String(date.getUTCMonth() + 1).padStart(2, '0'); // 月份是从0开始的
    let day = String(date.getUTCDate()).padStart(2, '0');
    let hours = String(date.getUTCHours()).padStart(2, '0');
    let minutes = String(date.getUTCMinutes()).padStart(2, '0');
    let seconds = String(date.getUTCSeconds()).padStart(2, '0');
    
    let newLastRunTime = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;

    // 将修改后的时间保存到Redis
    let key = `Yz:xianxin:patchwork:lastRunTime`;
    await redis.set(key, newLastRunTime);
  }

  async fetchPatches(since) {
    const url = `https://patchwork.kernel.org/api/1.2/series/?project=92&since=${since}`;
    const response = await fetch(url);
    const seriesList = await response.json();

    let message = "检测到新patch喔喔喔喔\n";
    if (seriesList.length > 0) {
      seriesList.forEach(series => {
        message += `Series:\n${series.name}\n`;
        message += `Author: ${series.submitter.name} <${series.submitter.email}>\n`;
        message += `\nPatch:\n`;
        // series.patches.forEach(patch => {
        //   message += `${patch.name}\n`;
        // });
        if (series.patches.length > 0) {
          message += `${series.patches[0].name}\n`;
        }

        message += "---------------------------------\n";
      });

      // 获取并保存最后一个patch的时间
      const lastSeries = seriesList[seriesList.length - 1];
      const lastPatchTime = lastSeries.patches.length > 0 ?
        lastSeries.patches[lastSeries.patches.length - 1].date : lastSeries.date;
      await this.saveLastRunTime(lastPatchTime);
    } else {
      message = "nan";
    }
    return message;
  }

  async newPushTask() {
    const since = await this.getLastRunTime();
    const message = await this.fetchPatches(since);
    if (message != "nan") {
      await Bot.pickGroup(737223105).sendMsg(message);
    }
  }

}