import plugin from "../../../lib/plugins/plugin.js";
import fetch from "node-fetch";
import lodash from "lodash";
import common from "../../../lib/common/common.js";
import xxCfg from "../model/xxCfg.js";
import fs from "node:fs";
import https from "https";
import http from "http";
import path from "node:path";

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const sharp = (await import('sharp')).default;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

//项目路径
const _path = process.cwd();

let randomvideo_ = [];

/**
 * 初始化工具设置文件
 */
let toolsSetFile = "./plugins/trss-xianxin-plugin/config/tools.set.yaml";
let mysterySetFile = "./plugins/trss-xianxin-plugin/config/mystery.set.yaml";
if (!fs.existsSync(mysterySetFile)) {
  if (fs.existsSync(toolsSetFile)) {
    fs.copyFileSync(toolsSetFile, mysterySetFile);
  } else {
    fs.copyFileSync(
      "./plugins/trss-xianxin-plugin/defSet/mystery/set.yaml",
      mysterySetFile
    );
  }
}

if (fs.existsSync(mysterySetFile) && fs.existsSync(toolsSetFile)) {
  fs.unlink(toolsSetFile, () => { });
}

let urlTypeCache = {};

let urlCache = {};

export class mystery extends plugin {
  constructor() {
    super({
      name: "神秘指令",
      dsc: "处理神秘指令代码",
      event: "message",
      priority: 4000,
      rule: [
        {
          reg: "^#*(woc|卧槽)\\s*[0-9]*$",
          fnc: "woc",
          permission: "master",
        },
        {
          reg: "^#*(woc|卧槽)\\s*pro$",
          fnc: "wocpro",
          permission: "master",
        },
        {
          reg: "^#*小视频\\s*[\u4e00-\u9fa5a-zA-Z]*\\s*[0-9]*$",
          fnc: "searchpro",
          permission: "master",
        },
        {
          // reg: "^#*(l)?sp\\s*[\u4e00-\u9fa5a-zA-Z\u3040-\u309F\u30A0-\u30FF]*\\s*[0-9]*$",
          reg: "^#*(l)?sp\\s*[\\u4e00-\\u9fa5a-zA-Z\\u3040-\\u309F\\u30A0-\\u30FF\\s]*\\s*[0-9]*$",
          fnc: "searchsp",
        },
        {
          reg: "^#*(开|开启|关|关闭)sp\\s*[0-9]*$",
          fnc: "ctrlsp",
          permission: "master",
        },
        {
          reg: "^#*(神秘)?(pro)?换源\\s*.*$",
          fnc: "wocurl",
          permission: "master",
        },
        {
          reg: "^#*/\*muteme\\s*[1-9]\\d*$",
          fnc: "muteme",
        },
      ],
    });

    /** 读取工具相关设置数据 */
    this.mysterySetData = xxCfg.getConfig("mystery", "set");

    this.rule[0].permission = this.mysterySetData.permission;
    this.rule[0].reg = `^#*(${this.mysterySetData.keywords.join(
      "|"
    )})\\s*[0-9]*$`;
    this.rule[1].permission = this.mysterySetData.permission;
    this.rule[1].reg = `^#*(${this.mysterySetData.keywords.join("|")})\\s*pro$`;
    this.rule[2].permission = this.mysterySetData.permission;

    this.path = "./data/wocmp4/";
  }

  async init() {
    if (!fs.existsSync(this.path)) {
      fs.mkdirSync(this.path);
    }
  }

  async woc() {

    const statu = !!this.mysterySetData.status === false ? true : false;
    if (statu) {
      return "return";
    }
    const isPrivate = this.e.isPrivate;

    if (!this.mysterySetData.isPrivate && isPrivate) {
      return "return";
    }

    // if (this.mysterySetData.permission == "master" && !this.e.isMaster) {
    //   return "return";
    // }

    // if (this.mysterySetData.permission == "admin" && !this.e.member.is_admin) {
    //   return "return";
    // }
    // if (this.mysterySetData.permission == "owner" && !this.e.member.is_owner) {
    //   return "return";
    // }

    if (this.mysterySetData.cd != 0) {
      /** cd */
      let key = `Yz:woc:${this.e.group_id}`;
      if (await redis.get(key)) return;
      redis.set(key, "1", { EX: Number(this.mysterySetData.cd) });
    }

    this.e.reply("触发探索未知的神秘空间，请稍等...", undefined, { recallMsg: 5, });
    let images = [];
    const isDimtown = this.mysterySetData.wocUrl.indexOf("dimtown.com") !== -1;

    const isCcy = this.mysterySetData.wocUrl.indexOf("ccy.moe") !== -1;

    if (this.mysterySetData.wocUrl.indexOf("/wp-json") !== -1) {
      const idx =
        this.e.msg.replace(
          new RegExp(`#*(${this.mysterySetData.keywords.join("|")})\s*`),
          ""
        ) || 0;

      const randomMax = isDimtown ? 400 : 500;

      const randomIndex = Math.floor(Math.random() * randomMax) + 1;

      const page = Math.ceil((idx || randomIndex) / 10);

      const fetchData = await fetch(`${this.mysterySetData.wocUrl}${page}`);
      const resJsonData = await fetchData.json();

      const index = idx ? idx % 10 : randomIndex % 10;

      if (!resJsonData.length) {
        this.e.reply("额。没有探索到，换个姿势再来一次吧～", undefined, { recallMsg: 60, });
        return "return";
      }

      const content = resJsonData[index].content;

      if (!content || !content.rendered) {
        this.e.reply("额。没有探索到，换个姿势再来一次吧～", undefined, { recallMsg: 60, });
        return "return";
      }

      images = this.getImages(content.rendered);
    } else {
      if (urlTypeCache[this.mysterySetData.wocUrl] == "buffer") {
        const image = await this.getBufferImage(
          `${this.mysterySetData.wocUrl}`
        );
        images = [image];
      } else {
        try {
          const fetchData = await fetch(`${this.mysterySetData.wocUrl}`);
          const resJsonData = await fetchData.json();

          images = this.getJsonImages(JSON.stringify(resJsonData));
        } catch (error) {
          urlTypeCache[this.mysterySetData.wocUrl] = "buffer";
          const image = await this.getBufferImage(
            `${this.mysterySetData.wocUrl}`
          );
          images = [image];
        }
      }
    }

    if (isDimtown && images.length > 1) {
      images.pop();
    }

    const imageCountLimit = this.mysterySetData.imageCountLimit || 10;

    if (images.length > imageCountLimit) {
      images = lodash.sampleSize(images, imageCountLimit);
    }

    const forwarder =
      this.mysterySetData.forwarder == "bot"
        ? { nickname: Bot.nickname, user_id: Bot.uin }
        : {
          nickname: this.e.sender.card || this.e.user_id,
          user_id: this.e.user_id,
        };

    if (images && images.length) {
      let temp, msgList = [];
      for (let imageItem of images) {
        /*const temp = isCcy
                  ? segment.image(imageItem, false, 10000, {
                      referer: "https://www.ccy.moe/",
                    })
                  : segment.image(imageItem); */
        if (isCcy) {
          const response = await fetch(imageItem, {
            method: "GET",
            headers: {
              'Accept': '*/*',
              'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2',
              'Accept-Encoding': 'gzip, deflate, br',
              'Content-type': 'application/json;charset=UTF-8',
              "referer": "https://i.lls.moe/",
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36 Edg/108.0.1462.46',
            },
            redirect: "follow",
          });
          const buffer = await response.arrayBuffer();
          const Data = Buffer.from(buffer);
          temp = segment.image(Data);
        } else if (!isCcy) {
          temp = segment.image(imageItem);
        }
        if (isPrivate) {
          await this.e.reply(temp, false, {
            recallMsg: this.mysterySetData.delMsg,
          });
          await common.sleep(600);
        } else {
          msgList.push({
            message: temp,
            ...forwarder,
          });
          //msgList.push(temp);
        }
      }
      if (isPrivate) {
        return;
      }
      msgList = await this.e.group.makeForwardMsg(msgList);
      const res = await this.e.reply(msgList, false, {
        recallMsg: this.mysterySetData.delMsg,
      });
      //let res;
      //const imgs = Array.from(msgList, item => ({ ...item }));
      //for (let i = 0; i < imgs.length; i++) {
      //  res = await this.e.reply(imgs[i], false, {
      //    recallMsg: this.mysterySetData.delMsg,
      //  });
      //}
      if (!res) {
        if (!res) {
          if (this.e.group && this.e.group.is_admin) {
            if (
              Number(Math.random().toFixed(2)) * 100 <
              this.mysterySetData.mute
            ) {
              let duration = Math.floor(Math.random() * 600) + 1;
              this.e.group.muteMember(this.e.sender.user_id, duration);
              await this.e.reply(
                `不用等了，你想要的已经被神秘的力量吞噬了～ 并随手将你禁锢${duration}秒`, undefined, { recallMsg: 60, }
              );
            } else {
              this.reply("不用等了，你想要的已经被神秘的力量吞噬了～", undefined, { recallMsg: 60, });
            }
          } else {
            this.reply("不用等了，你想要的已经被神秘的力量吞噬了～", undefined, { recallMsg: 60, });
          }
        }
      }
    } else {
      this.reply("额。没有探索到，换个姿势再来一次吧～", undefined, { recallMsg: 60, });
    }
  }

  async wocpro() {

    const statu = !!this.mysterySetData.status === false ? true : false;
    if (statu) {
      return "return";
    }
    const isPrivate = this.e.isPrivate;

    if (!this.mysterySetData.isPrivate && isPrivate && !this.e.isMaster) {
      return "return";
    }

    let key = `Yz:wocpro:${this.e.group_id || this.e.user_id}`;

    if (await redis.get(key)) {
      this.e.reply("探索中，请稍等...", undefined, { recallMsg: 60, });
      return;
    }
    // await fs.rmSync(`${this.path}${this.e.group_id}/temp.mp4`);
    redis.set(key, "1", { EX: 60 });

    this.e.reply("触发探索更深层面的未知神秘空间，请稍等...", undefined, { recallMsg: 60, });

    let url = this.mysterySetData.wocproUrl;

    // 借助渔火佬代码支持wocplus的源视频播放
    if (url.indexOf("gitee.com") !== -1) {
      if (urlCache != url || !randomvideo_.length) {
        let raw = await fetch(url);
        const videolist_ = await raw.json();
        randomvideo_ = videolist_.sort(function () {
          return Math.random() < 0.5 ? -1 : 1;
        });
      }

      urlCache = url;

      let res = await this.e.reply([randomvideo_.splice(0, 1)[0]], false, {
        recallMsg: this.mysterySetData.delMsg,
      });

      redis.del(key);
      if (!res) {
        this.e.reply("视频发送失败，可能被风控", undefined, { recallMsg: 60, });
        return;
      }
      return;
    } else if (
      url.indexOf("https://xiaobai.klizi.cn/API/video/ks_yanzhi.php") !== -1
    ) {
      const fetchData = await fetch(this.mysterySetData.wocproUrl);
      if (!fetchData.ok) {
        this.e.reply("诶嘿，网络或者源接口出了点问题，等会再试试吧~", undefined, { recallMsg: 60, });
        return;
      }
      const resJsonData = await fetchData.json();

      url = resJsonData.视频链接;

      if (url.indexOf("alimov2.a.kwimgs.com") !== -1) {
        url = url.replace(
          "alimov2.a.kwimgs.com",
          "v20bgqpl8ho2g96xjjjmilboxw3bxvob7.mobgslb.tbcache.com/alimov2.a.kwimgs.com"
        );
      }
    } else if (url.indexOf("api.wuxixindong.top/api/xjj.php") !== -1) {
      const fetchData = await fetch(`${this.mysterySetData.wocproUrl}`);
      if (!fetchData.ok) {
        this.e.reply("诶嘿，网络或者源接口出了点问题，等会再试试吧~", undefined, { recallMsg: 60, });
        return;
      }
      url = await fetchData.text();
    } else if (url.indexOf("xiaobai.klizi.cn/API/video/spzm.php") !== -1) {
      let max = url.indexOf("美女") !== -1 ? 10000 : 2300;

      const randomIndex = Math.floor(Math.random() * max) + 1;
      const fetchData = await fetch(
        `${this.mysterySetData.wocproUrl}&n=${randomIndex}`
      );
      if (!fetchData.ok) {
        this.e.reply("诶嘿，网络或者源接口出了点问题，等会再试试吧~");
        return;
      }
      url = await fetchData.text();
    } else if (url.indexOf("/api/spjh") !== -1) {
      const fetchData = await fetch(`${this.mysterySetData.wocproUrl}`);
      if (!fetchData.ok) {
        this.e.reply("诶嘿，网络或者源接口出了点问题，等会再试试吧~");
        return;
      }
      const resTextData = await fetchData.text();

      const fetch302Data = await fetch(resTextData);

      url = fetch302Data.url;
    } else if (url.indexOf("/api/nysp?key=qiqi") !== -1) {
      const fetchData = await fetch(`${this.mysterySetData.wocproUrl}`);
      if (!fetchData.ok) {
        this.e.reply("诶嘿，网络或者源接口出了点问题，等会再试试吧~");
        return;
      }
      const resTextData = await fetchData.text();

      const tempurl = resTextData.split("\n")[1];

      const fetch302Data = await fetch(tempurl);

      url = fetch302Data.url;
    } else if (url.indexOf("v.api.aa1.cn/api/api-dy-girl") !== -1) {
      const fetch302Data = await fetch(url);

      const urls = this.getJsonMp4(fetch302Data.url);

      url = urls[0] + "11包%20api.aa1.cn%20%20免费视频API.mp4";
    } else {
      if (urlTypeCache[this.mysterySetData.wocproUrl] == "buffer") {
        url = this.mysterySetData.wocproUrl;
      } else {
        try {
          const fetchData = await fetch(`${this.mysterySetData.wocproUrl}`);
          if (!fetchData.ok) {
            this.e.reply("诶嘿，网络或者源接口出了点问题，等会再试试吧~");
            return;
          }
          const resJsonData = await fetchData.json();

          const urls = this.getJsonMp4(JSON.stringify(resJsonData));
          if (urls && urls.length) {
            url = urls[0];
          }
        } catch (error) {
          url = this.mysterySetData.wocproUrl;
        }
      }
    }

    const filePath = await this.downloadMp4(url);

    const res = await this.e.reply(segment.video(filePath), false, {
      recallMsg: this.mysterySetData.delMsg,
    });

    redis.del(key);

    if (!res) {
      this.reply("不用等了，pro的力量需要ffmpeg驾驭哦");
    }
  }

  async searchpro() {
    let index =
      this.e.msg.replace(/#*小视频\s*[\u4e00-\u9fa5a-zA-Z]*\s*/g, "").trim() ||
      1;

    let keyword =
      this.e.msg
        .replace(/#*小视频\s*/g, "")
        .replace(index, "")
        .trim() || "热舞";

    const isPrivate = this.e.isPrivate;

    if (!this.mysterySetData.isPrivate && isPrivate && !this.e.isMaster) {
      return "return";
    }

    let key = `Yz:wocpro:${this.e.group_id || this.e.user_id}`;

    if (await redis.get(key)) {
      this.e.reply("探索中，请稍等...");
      return;
    }

    redis.set(key, "1", { EX: 60 });

    this.e.reply("触发探索更深层面的未知神秘空间，请稍等...", undefined, { recallMsg: 60, });

    let url = `https://xiaobai.klizi.cn/API/video/spzm.php?data=&msg=${keyword}&n=${index}`;

    const fetchData = await fetch(url);
    if (!fetchData.ok) {
      this.e.reply("诶嘿，网络或者源接口出了点问题，等会再试试吧~");
      return;
    }
    url = await fetchData.text();

    const filePath = await this.downloadMp4(url);

    const res = await this.e.reply(segment.video(filePath), false, {
      recallMsg: this.mysterySetData.delMsg,
    });

    redis.del(key);

    if (!res) {
      this.reply("不用等了，pro的力量需要ffmpeg驾驭哦");
    }
  }

  async ctrlsp() {
    let key = `Yz:lspstatus:${this.e.group_id || this.e.user_id}`;

    let qq = this.e.msg.replace(/#*(开|开启|关|关闭)sp\s*/g, "");

    if (qq) {
      key = `Yz:lspstatus:${qq}`;
    }

    if (this.e.msg.indexOf("开") !== -1) {
      redis.set(key, "1");
      this.e.reply(
        qq +
        "已开启sp功能\n#sp  -- 随机p站图\n#sp 2  -- 随机2张p站图\n#sp 雷神 2  -- 雷神相关2张p站图\n#lsp 雷神 2  -- 雷神相关2张p站r18图"
      );
    } else {
      redis.del(key);
      this.e.reply("sp功能已关闭");
    }
  }

  async muteme() {
    const isPrivate = this.e.isPrivate;
    if (isPrivate || !this.e.group.is_admin) {
      return;
    }

    logger.info(`why muteme`);
    let num;
    try {
      num = parseInt(this.e.msg.replace(/^#*\/*muteme\s*(\d+)$/, '$1'));
      if (isNaN(num)) {
          logger.info('Invalid number');
      }
    } catch (error) {
      logger.info('Failed to extract number:', error);
      num = null;
    }
    logger.info(`num=${num}`);
    this.e.group.muteMember(this.e.sender.user_id, num);
    await this.e.reply(
      `喔喔喔喔喔喔你已被禁锢${num}秒`
    );
  }

  async searchsp() {
    let key = `Yz:lspstatus:${this.e.group_id || this.e.user_id}`;

    const isPrivate = this.e.isPrivate;

    if (
      !this.mysterySetData.isPrivate &&
      isPrivate &&
      !(await redis.get(key))
    ) {
      return "return";
    }

    if (this.mysterySetData.cd != 0) {
      /** cd */
      let key = `Yz:sp:${this.e.group_id}`;
      if (await redis.get(key)) return;
      redis.set(key, "1", { EX: Number(this.mysterySetData.cd) });
    }

    if (!(await redis.get(key))) {
      this.e.reply("未开启sp功能，请发送 #开sp 进行开启");
      return;
    }

    let num =
      this.e.msg.replace(/#*(l)?sp\s*[\u4e00-\u9fa5a-zA-Z\u3040-\u309F\u30A0-\u30FF]*\s*/g, "").trim() ||
      1;

    // let keyword =
    //   this.e.msg
    //     .replace(/#*(l)?sp\s*/g, "")
    //     .replace(num, "")
    //     .trim() || "黑丝|白丝";

    let keyword =
      this.e.msg
        .replace(/^#*(l)?sp\s*/i, "")
        .replace(/\s*\d+$/, "")  // 移除末尾的数字
        .trim() || "黑丝|白丝";

    this.e.reply("触发探索未知的神秘空间，请稍等...", undefined, { recallMsg: 5, });

    const fetchData = await fetch(
      `https://api.lolicon.app/setu/v2?proxy=i.yuki.sh&tag=${keyword}&num=${num}&excludeAI=true&r18=${this.e.msg.indexOf("lsp") !== -1 ? 1 : 0
      }`
    );
    const resJsonData = await fetchData.json();
    logger.info(`tag=${keyword}`);
    logger.info(JSON.stringify(resJsonData));

    let images = this.getJsonImages(JSON.stringify(resJsonData));
    let pids = this.getJsonPid(JSON.stringify(resJsonData));
    let titles = this.getJsonTitles(JSON.stringify(resJsonData));
    let tagsList = this.getJsonTags(JSON.stringify(resJsonData));

    for (let pid of pids) {
      logger.info(`Pixiv ID: ${pid}`);
    }

    for (let title of titles) {
      logger.info(`Title: ${title}`);
    }
  
    for (let tags of tagsList) {
      logger.info(`Tags: ${tags.join(', ')}`);
    }
    const forwarder =
      this.mysterySetData.forwarder == "bot"
        ? { nickname: Bot.nickname, user_id: Bot.uin }
        : {
          nickname: this.e.sender.card || this.e.user_id,
          user_id: this.e.user_id,
        };

    if (images && images.length) {
      let msgList = [];
      for (let i = 0; i < images.length; i++) {
        let imageItem = images[i];
        logger.info(`imageItem: ${imageItem}`);

        let pid = pids[i];
        let title = titles[i];
        let tag = tagsList[i];

        const filePath = path.resolve(__dirname, '../../../data/test/', `image_${pid}.jpg`);
        let filepath_new;

        await new Promise((resolve, reject) => {
          const file = fs.createWriteStream(filePath);
          https.get(imageItem, (response) => {
            response.pipe(file).on('finish', () => {
              fs.readFile(filePath, 'utf8', async (err, data) => {
                if (err) {
                  logger.error(`Error reading image: ${err}`);
                  reject(err);
                  return;
                }
                if (data.startsWith('<!DOCTYPE html>')) {
                  // 图片损坏，设置 filepath_new 为 image_404.jpg
                  logger.info('Downloaded image is invalid (HTML content)');
                  filepath_new = path.resolve(__dirname, '../../../data/test/', 'image_404.jpg');
                  resolve();
                } else {
                  // 图片正常，旋转图片
                  const rotatedFilePath = filePath.replace('.jpg', '_rotate.jpg');
                  await sharp(filePath)
                    .rotate(90)
                    .toFile(rotatedFilePath);
                  logger.info(`Rotated image saved to: ${rotatedFilePath}`);
                  filepath_new = rotatedFilePath;
                  resolve();
                }
              });
            });
          }).on('error', (err) => {
            logger.error(`Error downloading image: ${err}`);
            reject(err);
          });
        });

        if (isPrivate) {
          await this.e.reply(segment.image(`file://${filepath_new}`), false, {
            recallMsg: this.mysterySetData.delMsg,
          });
          await common.sleep(600);
        } else {
          msgList.push({
            message: segment.image(`file://${filepath_new}`),
            ...forwarder,
          });
          msgList.push({
            message: `Pixiv ID: ${pid}\nTitle: ${title}\nTags: ${tag}`,
            ...forwarder,
          });
        }
      }

      if (isPrivate) {
        return;
      }

      msgList = await this.e.group.makeForwardMsg(msgList);
      const res = await this.e.reply(msgList, false, {
        recallMsg: this.mysterySetData.delMsg,
      });
      if (!res) {
        if (!res) {
          if (this.e.group && this.e.group.is_admin) {
            if (
              Number(Math.random().toFixed(2)) * 100 <
              this.mysterySetData.mute
            ) {
              let duration = Math.floor(Math.random() * 120) + 1;
              this.e.group.muteMember(this.e.sender.user_id, duration);
              await this.e.reply(
                `不用等了，你想要的已经被神秘的力量吞噬了～ 并随手将你禁锢${duration}秒\n(Pixiv ID: ${pids[0]})\nTitle: ${titles[0]}\nTags: ${tagsList[0]}`, undefined, { recallMsg: 120, }
              );
            } else {
              this.reply("不用等了，你想要的已经被神秘的力量吞噬了～\n(Pixiv ID: ${pids[0]})\nTitle: ${titles[0]}\nTags: ${tagsList[0]}", undefined, { recallMsg: 90, });
            }
          } else {
            this.reply(`不用等了，你想要的已经被神秘的力量吞噬了～\n(Pixiv ID: ${pids[0]})\nTitle: ${titles[0]}\nTags: ${tagsList[0]}`, undefined, { recallMsg: 90, });
          }
        }
      }
    } else {
      this.reply("额。没有探索到，换个姿势再来一次吧～", undefined, { recallMsg: 60, });
    }
  }

  async wocurl() {
    const isPro = this.e.msg.slice(0, 8).indexOf("pro") !== -1;

    let url = this.e.msg.replace(/#*(神秘)?(pro)?换源\s*/g, "") || "";
    if (url == "") {
      url = isPro
        ? "https://gitee.com/xianxincoder/data/raw/master/wocplus.json"
        : "https://yingtall.com/wp-json/wp/v2/posts?page=";
    }

    let obj = {};

    if (isPro) {
      obj = { wocproUrl: url };
    } else {
      obj = { wocUrl: url };
    }

    xxCfg.saveSet("mystery", "set", "config", {
      ...this.mysterySetData,
      ...obj,
    });

    this.e.reply(`已更换神秘${isPro ? "pro" : ""}代码源地址为：${url}`);
  }

  async downloadMp4(url) {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(`${this.path}${this.e.group_id || this.e.user_id}`)) {
        fs.mkdirSync(`${this.path}${this.e.group_id || this.e.user_id}`);
      }

      var protocol = url.indexOf("https:") !== -1 ? https : http;

      protocol
        .get(url, (res) => {
          const file = fs.createWriteStream(
            `${this.path}${this.e.group_id || this.e.user_id}/temp.mp4`
          );
          // Write data into local file
          res.pipe(file);
          // Close the file
          file.on("finish", () => {
            file.close();
            resolve(
              `${this.path}${this.e.group_id || this.e.user_id}/temp.mp4`
            );
          });
        })
        .on("error", (err) => {
          logger.error(`视频下载失败：${JSON.stringify(err)}`);
        });
    });
  }

  getImages(string) {
    const imgRex = /<img.*?src="(.*?)"[^>]+>/g;
    const images = [];
    let img;
    while ((img = imgRex.exec(string))) {
      images.push(encodeURI(img[1]));
    }
    return images;
  }

  getJsonPid(string) {
    const pidRex = /"pid":(\d+)/g;
    const pids = [];
    let id;
    while ((id = pidRex.exec(string))) {
      pids.push(id[1]);
    }
    return pids;
  }

  getJsonTitles(string) {
    const titleRex = /"title":"([^"]+)"/g;
    const titles = [];
    let title;
    while ((title = titleRex.exec(string))) {
      titles.push(title[1]);
    }
    return titles;
  }
  
  getJsonTags(string) {
    const tagsRex = /"tags":\[(.*?)\]/g;
    const allTags = [];
    let tagMatch;
    while ((tagMatch = tagsRex.exec(string))) {
      const tags = tagMatch[1].split(',').map(tag => tag.replace(/"/g, '').trim());
      allTags.push(tags);
    }
    return allTags;
  }

  getJsonImages(string) {
    const imgRex = /https?:\/\/.*?\.(jpg|JPG|png|PNG|gif|GIF|jpeg|JPEG)/g;
    const images = [];
    let img;
    while ((img = imgRex.exec(string))) {
      images.push(encodeURI(img[0]));
    }
    return images;
  }

  getJsonMp4(string) {
    const mp4Rex = /https?:\/\/.*?\.(mp4|m3u8)/g;
    const mp4s = [];
    let mp4;
    while ((mp4 = mp4Rex.exec(string))) {
      mp4s.push(mp4[0]);
    }
    return mp4s;
  }

  // 获取图片
  async getBufferImage(url) {
    let response = await fetch(url, {
      method: "get",
      responseType: "arraybuffer",
    });

    const buffer = await response.arrayBuffer();

    return (
      "base64://" +
      btoa(
        new Uint8Array(buffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      )
    );
  }
}
