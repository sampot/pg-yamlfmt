# pg-yamlfmt

**YAML 整形**：驗證與 pretty（縮排 2／4）。純前端；解析用 [js-yaml](https://github.com/nodeca/js-yaml)（首次載入需網路，esm.sh）。

也可當作 [Playgrounds（遊樂場）](https://play.samkuo.me/) 的 **Tool SAM**：匯入後，在工作沙盒開 `.yml`／`.yaml`，用「用沙盒開啟」掛上本小品。工具宣告在 `index.html` head（`sam:tool-kinds`／`sam:tool-globs`）。

## 一鍵開 SAM 小

**[一鍵開 SAM 小](https://play.samkuo.me/?open=sampot%2Fpg-yamlfmt&name=YAML%20%E6%95%B4%E5%BD%A2)**

```
https://play.samkuo.me/?open=sampot/pg-yamlfmt&name=YAML 整形
```

## 試玩（本機）

```bash
npx --yes serve .
```

離線時若 CDN 未快取，解析會失敗。

## License

MIT
