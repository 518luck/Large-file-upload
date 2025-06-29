const express = require('express')
const path = require('path')
const multiparty = require('multiparty')
const fse = require('fs-extra')
const router = express.Router()

const UPLOAD_DIR = path.resolve(__dirname, '../uploads')

// 提取文件后缀名
const extractExt = (filename) => {
  const lastDotIndex = filename.lastIndexOf('.')
  return lastDotIndex === -1 ? '' : filename.slice(lastDotIndex)
}

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

    const fileHash = fields.fileHash[0]
    const chunkHahs = fields.chunkHahs[0]
    const chunk = files.chunk[0]

    // 临时存放目录
    const chunkPath = path.resolve(UPLOAD_DIR, fileHash)

    // 创建目录文件
    if (!fse.existsSync(chunkPath)) {
      fse.mkdirsSync(chunkPath)
    }

    // 检查分片是否已存在
    const targetPath = `${chunkPath}/${chunkHahs}`
    if (fse.existsSync(targetPath)) {
      // 分片已存在，删除临时文件
      await fse.remove(chunk.path)
      res.json({
        ok: true,
        msg: '分片已存在，跳过上传',
      })
      return
    }

    // 将切片放入指定目录
    await fse.move(chunk.path, targetPath)

    res.json({
      ok: true,
      msg: '文件分片上传成功',
    })
  })
})

router.post('/merge', async (req, res) => {
  const { fileHash, fileName, size } = req.body

  const filePath = path.resolve(UPLOAD_DIR, fileHash + extractExt(fileName))

  if (fse.existsSync(filePath)) {
    res.json({
      ok: true,
      msg: '文件合并成功',
    })
    return
  }

  const chunkDir = path.resolve(UPLOAD_DIR, fileHash)
  if (!fse.existsSync(chunkDir)) {
    res.status(401).json({
      ok: false,
      msg: '文件合并失败',
    })
    return
  }

  try {
    // 合并操作
    const chunkPaths = await fse.readdir(chunkDir)
    chunkPaths.sort((a, b) => {
      return a.split('-')[1] - b.split('-')[1]
    })

    // 等待所有分片合并完成
    await Promise.all(
      chunkPaths.map((chunkPath, index) => {
        return new Promise((resolve, reject) => {
          const chunkFilePath = path.resolve(chunkDir, chunkPath)
          const readStream = fse.createReadStream(chunkFilePath)
          const writeStream = fse.createWriteStream(filePath, {
            start: index * size,
            end: (index + 1) * size - 1,
          })

          readStream.on('end', () => {
            // 删除分片文件
            try {
              fse.unlinkSync(chunkFilePath)
            } catch (err) {
              console.log('删除分片文件失败:', err.message)
            }
            resolve()
          })

          readStream.on('error', reject)
          writeStream.on('error', reject)

          readStream.pipe(writeStream)
        })
      })
    )

    // 等待一小段时间确保所有文件句柄都释放
    await new Promise((resolve) => setTimeout(resolve, 100))

    // 删除分片目录
    try {
      await fse.remove(chunkDir)
      console.log('分片目录删除成功:', chunkDir)
    } catch (err) {
      console.log('删除分片目录失败:', err.message)
      // 尝试强制删除
      try {
        await fse.emptyDir(chunkDir)
        await fse.rmdir(chunkDir)
        console.log('强制删除分片目录成功')
      } catch (forceErr) {
        console.log('强制删除分片目录也失败:', forceErr.message)
      }
    }

    res.json({
      ok: true,
      msg: '文件合并成功',
    })
  } catch (error) {
    console.error('文件合并失败:', error)
    res.status(500).json({
      ok: false,
      msg: '文件合并失败',
    })
  }
})

module.exports = router
