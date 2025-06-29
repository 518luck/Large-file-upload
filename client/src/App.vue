<script setup lang="ts">
import type { UploadUserFile, UploadProps } from 'element-plus'
import { ref } from 'vue'
import SparkMd5 from 'spark-md5'

const CHUNK_SIZE = 1024 * 1024

const fileList = ref<UploadUserFile[]>([])
const fileHash = ref<string>('')
const fileName = ref<string>('')

// 文件分片
const createChunks = (file: File) => {
  let cur = 0 // 当前分片索引
  let chunks = [] //用来存储分片

  while (cur < file.size) {
    // 文件分片的核心是用Blob 对象的 slice 方法 file是继承Blob的所以file可以直接使用slice
    const blob = file.slice(cur, cur + CHUNK_SIZE)
    cur += CHUNK_SIZE
    chunks.push(blob)
  }

  return chunks
}

// 计算哈希值
const calculateHashes = (chunks: Blob[]) => {
  return new Promise((resolve) => {
    // 计算策略,第一个最后一个切片参与计算,中间只计算前2个中间2个后面2个字节
    const targets: Blob[] = [] // 用来存储参与计算的切片
    const spark = new SparkMd5.ArrayBuffer()
    const fileReader = new FileReader()

    chunks.forEach((chunk, index) => {
      if (index === 0 || index === chunks.length - 1) {
        // 第一个最后一个切片参与计算
        targets.push(chunk)
      } else {
        // 中间只计算前2个中间2个后面2个字节
        targets.push(chunk.slice(0, 2))
        targets.push(chunk.slice(CHUNK_SIZE / 2, CHUNK_SIZE / 2 + 2))
        targets.push(chunk.slice(CHUNK_SIZE - 2, CHUNK_SIZE))
      }
      return targets
    })

    fileReader.readAsArrayBuffer(new Blob(targets))
    fileReader.onload = (e) => {
      if (!e.target) return
      spark.append((e.target as FileReader).result as ArrayBuffer)
      resolve(spark.end())
    }
  })
}

// 上传分片
const uploadChunks = async (chunks: Blob[]) => {
  // 获得一个对象数组
  const data = chunks.map((chunk, index) => {
    return {
      fileHash: fileHash.value,
      chunkHahs: fileHash.value + '-' + index,
      chunk: chunk,
    }
  })
  // 将对象数组转换为formData数组
  const formDatas = data.map((item) => {
    const formData = new FormData()
    formData.append('fileHash', item.fileHash)
    formData.append('chunkHahs', item.chunkHahs)
    formData.append('chunk', item.chunk)
    return formData
  })

  const max = 6
  let index = 0
  const taskPool = [] //请求池

  while (index < formDatas.length) {
    const task = fetch('/upload', {
      method: 'POST',
      body: formDatas[index],
    })

    taskPool.splice(
      taskPool.findIndex((item) => item === task),
      1
    )
    taskPool.push(task)
    if (taskPool.length === max) {
      await Promise.race(taskPool)
    }
    index++
  }

  await Promise.all(taskPool)
}

const handleFileChange: UploadProps['onChange'] = async (
  uploadFile,
  uploadFiles
) => {
  const file = uploadFile.raw

  if (!file) return
  // 文件分片
  const chunks = createChunks(file)
  // 计算哈希值
  const hash = await calculateHashes(chunks)

  fileHash.value = hash as string
  fileName.value = file.name
  // 上传分片
  const data = uploadChunks(chunks)
  console.log(data)
}
</script>

<template>
  <div class="bigMin">
    <span>大文件上传</span>
    <el-button type="primary">Primary</el-button>
    <div class="upload">
      <el-upload
        v-model:file-list="fileList"
        @change="handleFileChange"
        :auto-upload="false">
        <el-button type="primary">Click to upload</el-button>
      </el-upload>
    </div>
  </div>
</template>

<style scoped lang="scss">
.bigMin {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  span {
    margin-bottom: 10px;
  }
  .upload {
    margin-top: 20px;
  }
}
</style>
