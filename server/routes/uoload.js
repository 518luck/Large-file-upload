const express = require('express')
const path = require('path')
const multiparty = require('multiparty')
const fse = require('fs-extra')
const router = express.Router()

const UPLOAD_DIR = path.resolve(__dirname, '../uploads')

// 处理文件分片上传
router.post('/', (req, res) => {
  const form = new multiparty.Form()

  form.parse(req, async (err, fields, files) => {
    if (err) {
      res.status(401).json({
        ok: false,
        msg: '文件上传失败',
      })
      return
    }

    console.log('接收到的字段:', fields)
    console.log('接收到的文件:', files)

    const fileHash = fields.fileHash[0]
    const chunkHahs = fields.chunkHahs[0]
    const chunk = files.chunk[0]

    // 临时存放目录
    const chunkPath = path.resolve(UPLOAD_DIR, fileHash)

    // 创建目录文件
    if (!fse.existsSync(chunkPath)) {
      fse.mkdirsSync(chunkPath)
    }
    // 将切片放入指定目录
    await fse.move(chunk.path, `${chunkPath}/${chunkHahs}`)

    res.json({
      ok: true,
      msg: '文件分片上传成功',
    })
  })
})

module.exports = router
