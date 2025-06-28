<script setup lang="ts">
import type { UploadUserFile, UploadProps } from 'element-plus'
import { ref } from 'vue'

const fileList = ref<UploadUserFile[]>([])

const handleFileChange: UploadProps['onChange'] = (uploadFile, uploadFiles) => {
  const file = uploadFile.raw

  if (file) {
    console.log('完整文件对象:', file)
    console.log('文件名:', file.name)
    console.log('文件大小:', file.size, '字节')
    console.log('文件类型:', file.type)
    console.log('最后修改:', file.lastModified)
  }

  console.log('当前选择的文件:', uploadFile)
  console.log('所有文件列表:', uploadFiles)
  console.log('fileList.value:', fileList.value)
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
