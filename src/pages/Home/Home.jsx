import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { io } from 'socket.io-client'
import { useAuth } from '../../context/AuthContext'
import './Home.css'
import CallModal from '../../components/CallModal/CallModal'

function Home() {
  const navigate = useNavigate()
  const { user, login: updateAuthUser, logout: authLogout } = useAuth()
  const [activeTab, setActiveTab] = useState('messages')

  const [profileData, setProfileData] = useState({ fullName: '', phoneNumber: '', dateOfBirth: '', position: '', avatarUrl: '' })
  const [isEditing, setIsEditing] = useState(false)
  const [contacts, setContacts] = useState([])
  const [searchResults, setSearchResults] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [conversations, setConversations] = useState([])
  const [activeChat, setActiveChat] = useState(null)
  const [chatDetail, setChatDetail] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [typingUsers, setTypingUsers] = useState({})
  const [members, setMembers] = useState([])
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [sharedMedia, setSharedMedia] = useState([])
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [selectedMembers, setSelectedMembers] = useState([])
  const callModalRef = useRef(null)
  const [showGroupCall, setShowGroupCall] = useState(false)

  // AI Features State
  const [aiSummary, setAiSummary] = useState('')
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [aiBotMessages, setAiBotMessages] = useState([
    { role: 'assistant', content: 'Chào bạn! Tôi là trợ lý AI nội bộ của doanh nghiệp. Bạn có thể hỏi tôi bất cứ điều gì về quy định, chính sách hoặc thông tin công việc.' }
  ])
  const [aiBotInput, setAiBotInput] = useState('')
  const [isAiProcessing, setIsAiProcessing] = useState(false)

  // Admin Features State
  const [adminUsers, setAdminUsers] = useState([])
  const [pendingUsers, setPendingUsers] = useState([])
  const [isAdminLoading, setIsAdminLoading] = useState(false)
  const [adminSubTab, setAdminSubTab] = useState('all') // 'all' or 'pending'
  const [showCreateUserModal, setShowCreateUserModal] = useState(false)
  const [newUserForm, setNewUserForm] = useState({ email: '', fullName: '', password: '', roleId: 2 }) // 1: Admin, 2: Staff

  // Content Management State
  const [reports, setReports] = useState([])
  const [auditMsgs, setAuditMsgs] = useState([])
  const [auditRoomId, setAuditRoomId] = useState('')
  const [hasAudited, setHasAudited] = useState(false)
  const [isContentLoading, setIsContentLoading] = useState(false)
  const [contentSubTab, setContentSubTab] = useState('reports') // 'reports' or 'audit'
  const [adminConversations, setAdminConversations] = useState([])

  // System Config State
  const [sysConfig, setSysConfig] = useState({ isRegistrationEnabled: true, isMaintenanceMode: false })
  const [sysHealth, setSysHealth] = useState(null)

  const handleInitiateCall = async (type) => {
    if (chatDetail?.isGroup) {
      setShowGroupCall(true);
      try {
        const msg = type === 'video' ? '📽️ Mình đang mở phòng Tán gẫu Video. Mọi người bấn nút Máy quay ở góc trên bên phải để vào nói chuyện nhé!' : '📞 Mình bắt đầu gọi thoại Nhóm. Mọi người bấm nút Điện thoại bàn góc trên cùng để tham gia nhé!';
        await axios.post(`${API_URL}/conversations/messages`, { conversationId: activeChat, messageContent: msg }, axiosConfig);
      } catch (err) { }
      return;
    }
    try {
      const resp = await axios.get(`${API_URL}/conversations/${activeChat}/members`, axiosConfig);
      const otherMember = resp.data.data.find(m => String(m.userId) !== String(user.userId));
      if (otherMember && callModalRef.current) {
        callModalRef.current.initiateCall(otherMember.userId, type, otherMember.fullName);
      } else {
        alert("Không tìm thấy thông tin người dùng.");
      }
    } catch (err) { alert("Lỗi khi kết nối cuộc gọi."); }
  }

  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])

  const socketRef = useRef()
  const messagesEndRef = useRef(null)
  const activeChatRef = useRef(activeChat)

  useEffect(() => { activeChatRef.current = activeChat }, [activeChat])

  const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'
  const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'
  const token = sessionStorage.getItem('access_token')
  const axiosConfig = { headers: { Authorization: `Bearer ${token}` } }

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }) }

  useEffect(() => {
    if (!user || !token) return
    socketRef.current = io(SOCKET_URL, { auth: { token: `Bearer ${token}` }, transports: ['websocket'] })

    socketRef.current.on('new_message', (data) => {
      if (String(activeChatRef.current) === String(data.conversationId)) {
        setMessages(prev => {
          const exists = prev.find(m => m.messageId === data.messageId)
          return exists ? prev.map(m => m.messageId === data.messageId ? data : m) : [...prev, data]
        })
      }
      fetchConversations()
    })

    socketRef.current.on('user_typing', (data) => {
      setTypingUsers(prev => {
        const conversationTyping = { ...(prev[data.conversationId] || {}) }
        if (data.isTyping) {
          conversationTyping[data.userId] = data.fullName || 'Ai đó'
        } else {
          delete conversationTyping[data.userId]
        }
        return { ...prev, [data.conversationId]: conversationTyping }
      })
    })

    return () => socketRef.current?.disconnect()
  }, [user, token])

  useEffect(() => {
    if (activeChat && socketRef.current) {
      socketRef.current.emit('join_conversation', { conversationId: activeChat })
      return () => socketRef.current.emit('leave_conversation', { conversationId: activeChat })
    }
  }, [activeChat])

  useEffect(() => { scrollToBottom() }, [messages])

  const fetchProfile = async () => {
    try {
      const resp = await axios.get(`${API_URL}/users/me`, axiosConfig)
      if (resp.data.success) { setProfileData(resp.data.data); updateAuthUser(resp.data.data, token) }
    } catch (err) { console.error(err) }
  }

  const fetchContacts = async () => {
    try {
      const resp = await axios.get(`${API_URL}/users/contacts`, axiosConfig)
      if (resp.data.success) setContacts(resp.data.data || [])
    } catch (err) { console.error(err) }
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (searchQuery.length < 2) return
    try {
      const resp = await axios.get(`${API_URL}/users/search?q=${searchQuery}`, axiosConfig)
      if (resp.data.success) setSearchResults(resp.data.data)
    } catch (err) { console.error(err) }
  }

  const addContact = async (colleagueId) => {
    try {
      const resp = await axios.post(`${API_URL}/users/contacts`, { colleagueId }, axiosConfig)
      if (resp.data.success) { fetchContacts(); handleSearch({ preventDefault: () => { } }) }
    } catch (err) { console.error(err) }
  }

  const handleStartPersonalChat = async (targetUserId) => {
    try {
      const resp = await axios.post(`${API_URL}/conversations`, { isGroup: false, targetUserId }, axiosConfig);
      setActiveTab('messages');
      fetchConversations();
      selectChat(resp.data.data.conversationId);
    } catch (e) {
      alert("Không thể bắt đầu cuộc trò chuyện.");
    }
  }

  const fetchConversations = async () => {
    try {
      const resp = await axios.get(`${API_URL}/conversations`, axiosConfig)
      if (resp.data.success) setConversations(resp.data.data || [])
    } catch (err) { console.error(err) }
  }

  const selectChat = async (id) => {
    setActiveChat(id)
    try {
      const [messagesResp, detailResp] = await Promise.all([
        axios.get(`${API_URL}/conversations/${id}/messages`, axiosConfig),
        axios.get(`${API_URL}/conversations/${id}`, axiosConfig)
      ])
      const msgData = messagesResp.data.data
      setMessages(Array.isArray(msgData) ? [...msgData].reverse() : [])
      setChatDetail(detailResp.data.data || null)
    } catch (err) {
      console.error(err)
      setMessages([])
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !activeChat) return
    try {
      await axios.post(`${API_URL}/conversations/messages`, { conversationId: activeChat, messageContent: newMessage }, axiosConfig)
      setNewMessage('')
    } catch (err) { alert(err.response?.data?.message) }
  }

  const typingTimeoutRef = useRef(null)

  const handleTyping = () => {
    if (!socketRef.current || !activeChat) return

    // Emit typing_start
    socketRef.current.emit('typing_start', { conversationId: activeChat })

    // Clear previous timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)

    // Set timeout to stop typing status
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current.emit('typing_stop', { conversationId: activeChat })
    }, 2000)
  }

  const toggleMemberSelection = (userId) => {
    setSelectedMembers(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId])
  }

  const createGroupChat = async () => {
    if (!groupName.trim()) return
    if (selectedMembers.length === 0) { alert("Vui lòng chọn ít nhất 1 thành viên."); return; }
    try {
      const resp = await axios.post(`${API_URL}/conversations`, { isGroup: true, conversationName: groupName, memberIds: selectedMembers }, axiosConfig)
      setGroupName(''); setSelectedMembers([]); setIsCreatingGroup(false); fetchConversations(); selectChat(resp.data.data.conversationId)
    } catch (err) { alert(err.response?.data?.message) }
  }

  const fetchSharedMedia = async (cid) => {
    try {
      const resp = await axios.get(`${API_URL}/media/conversation/${cid}`, axiosConfig)
      if (resp.data.success) setSharedMedia(resp.data.data)
    } catch (err) { console.error(err) }
  }

  const viewMembers = async () => {
    try {
      const resp = await axios.get(`${API_URL}/conversations/${activeChat}/members`, axiosConfig)
      if (resp.data.success) {
        setMembers(resp.data.data);
        fetchSharedMedia(activeChat);
        setShowMemberModal(true)
      }
    } catch (err) { console.error(err) }
  }

  const removeMemberFromGroup = async (userId) => {
    if (!window.confirm("Xóa khỏi nhóm?")) return
    try { await axios.delete(`${API_URL}/conversations/members`, { data: { conversationId: activeChat, memberIdToRemove: userId }, ...axiosConfig }); viewMembers() } catch (err) { alert(err.response?.data?.message) }
  }

  const leaveGroup = async () => {
    if (!window.confirm("Rời nhóm?")) return
    try { await axios.post(`${API_URL}/conversations/leave`, { conversationId: activeChat }, axiosConfig); setActiveChat(null); fetchConversations(); setShowMemberModal(false) } catch (err) { alert(err.response?.data?.message) }
  }

  const deleteConversation = async () => {
    if (!window.confirm("Giải tán nhóm?")) return
    try { await axios.delete(`${API_URL}/conversations/${activeChat}`, axiosConfig); setActiveChat(null); fetchConversations(); setShowMemberModal(false) } catch (err) { alert(err.response?.data?.message) }
  }

  const updateGroupInfo = async () => {
    const n = prompt("Tên nhóm mới:", chatDetail?.conversationName)
    if (!n) return
    try { await axios.put(`${API_URL}/conversations/${activeChat}`, { conversationName: n }, axiosConfig); selectChat(activeChat) } catch (err) { alert(err.response?.data?.message) }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file || !activeChat) return
    const formData = new FormData()
    formData.append('file', file)
    formData.append('conversationId', activeChat)
    formData.append('messageType', file.type.startsWith('image/') ? 'media' : 'file')
    try {
      await axios.post(`${API_URL}/media/upload`, formData, { headers: { ...axiosConfig.headers, 'Content-Type': 'multipart/form-data' } })
      fetchConversations(); selectChat(activeChat)
    } catch (err) { alert(err.response?.data?.message || "Lỗi tải tệp lên.") }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      audioChunksRef.current = []
      mediaRecorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data)
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const formData = new FormData()
        formData.append('file', audioBlob, 'voice_message.webm')
        formData.append('conversationId', activeChat)
        formData.append('messageType', 'voice')
        await axios.post(`${API_URL}/media/upload`, formData, { headers: { ...axiosConfig.headers, 'Content-Type': 'multipart/form-data' } })
        fetchConversations(); selectChat(activeChat)
      }
      mediaRecorderRef.current.start(); setIsRecording(true)
    } catch (err) { alert("Không thể truy cập Micro.") }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop())
      setIsRecording(false)
    }
  }

  const handleLogout = async () => { try { await axios.post(`${API_URL}/auth/logout`, {}, axiosConfig) } catch (err) { } authLogout(); navigate('/login') }

  // AI Functions
  const handleSummarize = async () => {
    if (!activeChat) return
    setIsSummarizing(true)
    setShowSummaryModal(true)
    setAiSummary('Đang tóm tắt cuộc hội thoại...')
    try {
      const resp = await axios.post(`${API_URL}/ai/summarize`, { conversationId: activeChat }, axiosConfig)
      if (resp.data.success) {
        setAiSummary(resp.data.data.summary)
      } else {
        setAiSummary('Không thể tóm tắt cuộc hội thoại này.')
      }
    } catch (err) {
      setAiSummary('Lỗi khi gọi AI tóm tắt: ' + (err.response?.data?.message || err.message))
    } finally {
      setIsSummarizing(false)
    }
  }

  const handleAiBotQuery = async (e) => {
    e.preventDefault()
    if (!aiBotInput.trim() || isAiProcessing) return

    const userMsg = { role: 'user', content: aiBotInput }
    setAiBotMessages(prev => [...prev, userMsg])
    setAiBotInput('')
    setIsAiProcessing(true)

    try {
      const resp = await axios.post(`${API_URL}/ai/query`, { question: userMsg.content }, axiosConfig)
      if (resp.data.success) {
        setAiBotMessages(prev => [...prev, { role: 'assistant', content: resp.data.data.answer }])
      }
    } catch (err) {
      setAiBotMessages(prev => [...prev, { role: 'assistant', content: 'Xin lỗi, tôi gặp lỗi khi xử lý câu hỏi của bạn. Vui lòng thử lại sau.' }])
    } finally {
      setIsAiProcessing(false)
    }
  }

  // Admin Functions
  const fetchAdminUsers = async () => {
    setIsAdminLoading(true)
    try {
      const resp = await axios.get(`${API_URL}/admin/users`, axiosConfig)
      if (resp.data.success) setAdminUsers(resp.data.data || [])
    } catch (err) {} finally { setIsAdminLoading(false) }
  }

  const fetchPendingUsers = async () => {
    setIsAdminLoading(true)
    try {
      const resp = await axios.get(`${API_URL}/admin/users/pending`, axiosConfig)
      if (resp.data.success) setPendingUsers(resp.data.data || [])
    } catch (err) {} finally { setIsAdminLoading(false) }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    try {
      await axios.post(`${API_URL}/admin/users`, newUserForm, axiosConfig)
      alert("Tạo tài khoản thành công!")
      setShowCreateUserModal(false)
      fetchAdminUsers()
    } catch (err) { alert(err.response?.data?.message || "Lỗi khi tạo tài khoản.") }
  }

  const handleApproveUser = async (uid) => {
    try {
      await axios.patch(`${API_URL}/admin/users/${uid}/approve`, {}, axiosConfig)
      alert("Đã duyệt tài khoản!")
      fetchPendingUsers()
    } catch (err) { alert(err.response?.data?.message) }
  }

  const updateUserRole = async (uid, roleId) => {
    try {
      await axios.put(`${API_URL}/admin/users/${uid}`, { roleId }, axiosConfig)
      alert("Đã cập nhật quyền!")
      fetchAdminUsers()
    } catch (err) { alert(err.response?.data?.message) }
  }

  const updateUserStatus = async (uid, status) => {
    try {
      await axios.put(`${API_URL}/admin/users/${uid}`, { status }, axiosConfig)
      alert(`Đã ${status === 'locked' ? 'khóa' : 'mở khóa'} tài khoản!`)
      fetchAdminUsers()
    } catch (err) { alert(err.response?.data?.message) }
  }


  const deleteUser = async (uid) => {
    if (!window.confirm("Xác nhận xóa tài khoản này? (Xóa mềm)")) return
    try {
      await axios.delete(`${API_URL}/admin/users/${uid}`, axiosConfig)
      alert("Đã xóa tài khoản!")
      fetchAdminUsers()
    } catch (err) { alert(err.response?.data?.message) }
  }

  // Content Management Functions
  const fetchReports = async () => {
    setIsContentLoading(true)
    try {
      const resp = await axios.get(`${API_URL}/admin/reports`, axiosConfig)
      if (resp.data.success) setReports(resp.data.data || [])
    } catch (err) {} finally { setIsContentLoading(false) }
  }

  const handleAuditChat = async (e) => {
    e.preventDefault()
    if (!auditRoomId) return
    setIsContentLoading(true)
    setHasAudited(false)
    try {
      const resp = await axios.get(`${API_URL}/admin/audit/messages/${auditRoomId}`, axiosConfig)
      if (resp.data.success) {
        setAuditMsgs(resp.data.data || [])
        setHasAudited(true)
      }
    } catch (err) { alert("Không thể truy xuất lịch sử phòng này hoặc sai ID.") } finally { setIsContentLoading(false) }
  }

  const fetchAdminConversations = async () => {
    try {
      const resp = await axios.get(`${API_URL}/admin/conversations`, axiosConfig)
      if (resp.data.success) setAdminConversations(resp.data.data || [])
    } catch (err) {}
  }

  const handleSelectAuditConversation = (cid) => {
    setAuditRoomId(cid)
    // Auto fetch when selected
    const dummyEvent = { preventDefault: () => {} };
    // I need handleAuditChat to take the ID directly or use state
  }

  // Need to update handleAuditChat to use a specific ID if provided

  const processReport = async (rid, action, note) => {
    try {
      await axios.post(`${API_URL}/admin/reports/${rid}/action`, { action, adminNote: note }, axiosConfig)
      alert("Đã xử lý báo cáo thành công.")
      fetchReports()
    } catch (err) { alert(err.response?.data?.message) }
  }

  const fetchSystemConfig = async () => {
    try {
      const resp = await axios.get(`${API_URL}/admin/config`, axiosConfig)
      if (resp.data.success) setSysConfig(resp.data.data)
    } catch (err) {}
  }

  const fetchSystemHealth = async () => {
    try {
      const resp = await axios.get(`${API_URL}/admin/health`, axiosConfig)
      if (resp.data.success) setSysHealth(resp.data.status)
    } catch (err) {}
  }

  const toggleConfig = async (key) => {
    try {
      const endpoint = key === 'registration' ? '/admin/config/registration' : '/admin/config/maintenance'
      const payload = key === 'registration' ? { isEnabled: !sysConfig.isRegistrationEnabled } : { isMaintenance: !sysConfig.isMaintenanceMode }
      const resp = await axios.patch(`${API_URL}${endpoint}`, payload, axiosConfig)
      if (resp.data.success) {
        setSysConfig(prev => ({
          ...prev,
          ...(key === 'registration' ? { isRegistrationEnabled: resp.data.data.isEnabled } : { isMaintenanceMode: resp.data.data.isMaintenance })
        }))
        if(key === 'maintenance' && resp.data.data.isMaintenance) {
          alert('CHÚ Ý: Chế độ bảo trì đã BẬT. Người dùng phổ thông sẽ không thể sử dụng hệ thống.')
        }
      }
    } catch (err) { alert('Cập nhật thất bại') }
  }

  useEffect(() => {
    if (!user && !sessionStorage.getItem('access_token')) {
      navigate('/login')
    }
    if (activeTab === 'profile') fetchProfile()
    if (activeTab === 'contacts') fetchContacts()
    if (activeTab === 'messages') { fetchConversations(); fetchContacts() }
    if (activeTab === 'admin') { fetchPendingUsers(); fetchAdminUsers(); }
    if (activeTab === 'content') { fetchReports(); fetchAdminConversations(); }
    if (activeTab === 'config') { fetchSystemConfig(); fetchSystemHealth(); }
  }, [activeTab, user, navigate])

  if (!user) return null

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-brand" onClick={() => setActiveTab('overview')}>
          <span className="brand-name">Nexus Chat</span>
        </div>
        <nav className="sidebar-nav">
          <div className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            <span>Tổng quan</span>
          </div>

          <div className={`nav-item ${activeTab === 'messages' ? 'active' : ''}`} onClick={() => setActiveTab('messages')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            <span>Tin nhắn</span>
          </div>

          <div className={`nav-item ${activeTab === 'contacts' ? 'active' : ''}`} onClick={() => setActiveTab('contacts')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            <span>Danh bạ</span>
          </div>

          <div className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            <span>Hồ sơ</span>
          </div>

          <div className="sidebar-divider" style={{ height: '1px', background: '#eee', margin: '0.5rem 1rem' }}></div>

          <div className={`nav-item ${activeTab === 'aibot' ? 'active' : ''}`} onClick={() => setActiveTab('aibot')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><path d="M12 7v5"></path><path d="M12 16v.01"></path></svg>
            <span>Hỏi đáp AI</span>
          </div>

          {user.role?.toLowerCase() === 'admin' && (
            <div className={`nav-item ${activeTab === 'admin' ? 'active' : ''}`} onClick={() => setActiveTab('admin')} style={{ marginTop: 'auto' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              <span>Quản trị nhân sự</span>
            </div>
          )}

          {user.role?.toLowerCase() === 'admin' && (
            <div className={`nav-item ${activeTab === 'content' ? 'active' : ''}`} onClick={() => setActiveTab('content')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              <span>Quản lý nội dung</span>
            </div>
          )}

          {user.role?.toLowerCase() === 'admin' && (
            <div className={`nav-item ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              <span>Cấu hình hệ thống</span>
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            <span>Thoát</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-header">
          <div style={{ fontWeight: 700, fontSize: '1.2rem' }}>Chào mừng, {user.fullName}</div>
          <div className="user-profile-summary">
            <div className="user-avatar-small" style={{ width: 38, height: 38, borderRadius: '50%', background: '#0084ff', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{user.fullName?.charAt(0)}</div>
          </div>
        </header>

        <section className="content-area">
          {activeTab === 'messages' && (
            <div className="chat-interface">
              <div className={`conv-sidebar ${activeChat ? 'mobile-hide' : ''}`}>
                <div className="conv-header">
                  <h3>Đoạn chat</h3>
                  <button className="btn-close" onClick={() => setIsCreatingGroup(!isCreatingGroup)} style={{ fontSize: '1.2rem' }}>➕</button>
                </div>
                {isCreatingGroup && (
                  <div style={{ padding: '0 1rem 1rem', borderBottom: '1px solid #eee' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', background: '#f0f2f5', padding: '0.5rem', borderRadius: '10px', marginBottom: '0.5rem' }}>
                      <input type="text" placeholder="Tên nhóm..." value={groupName} onChange={e => setGroupName(e.target.value)} style={{ border: 'none', background: 'transparent', flex: 1, outline: 'none' }} />
                    </div>
                    <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                      {contacts.map(c => (
                        <div key={c.userId} onClick={() => toggleMemberSelection(c.userId)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', cursor: 'pointer', background: selectedMembers.includes(c.userId) ? '#e7f3ff' : 'transparent', borderRadius: '8px' }}>
                          <input type="checkbox" checked={selectedMembers.includes(c.userId)} readOnly />
                          <span style={{ fontSize: '0.9rem' }}>{c.fullName || 'Người dùng'}</span>
                        </div>
                      ))}
                    </div>
                    <button onClick={createGroupChat} style={{ width: '100%', background: '#0084ff', color: 'white', border: 'none', padding: '0.5rem', borderRadius: '8px', fontWeight: 700, marginTop: '0.5rem' }}>Tạo nhóm</button>
                  </div>
                )}
                <div className="conv-list">
                  {conversations.map(c => (
                    <div key={c.conversationId} className={`conv-item ${String(activeChat) === String(c.conversationId) ? 'active' : ''}`} onClick={() => selectChat(c.conversationId)}>
                      <div className="conv-avatar">{c.name?.charAt(0) || '?'}</div>
                      <div className="conv-info">
                        <span className="conv-name">{c.name || 'Hội thoại'}</span>
                        <span className="conv-last-msg">{c.lastMessage || 'Bắt đầu ngay...'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`chat-window ${!activeChat ? 'mobile-hide' : ''}`}>
                {activeChat ? (
                  <>
                    <div className="chat-header">
                      <div className="chat-header-info" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <button className="btn-close mobile-only" onClick={() => setActiveChat(null)} style={{ marginRight: '0.5rem' }}>⬅</button>
                        <div style={{ minWidth: 0 }}>
                          <h4>{chatDetail?.conversationName || '...'}</h4>
                          {Object.keys(typingUsers[activeChat] || {}).length > 0 && (
                            <small style={{ color: '#0084ff', fontSize: '0.75rem' }}>
                              {Object.values(typingUsers[activeChat]).join(', ')} đang nhập...
                            </small>
                          )}
                        </div>
                      </div>
                      <div className="chat-header-actions">
                        {chatDetail && (
                          <>
                            <button className="icon-btn" onClick={() => handleInitiateCall('voice')} title="Gọi thoại">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                            </button>
                            <button className="icon-btn" onClick={() => handleInitiateCall('video')} title="Gọi video">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                            </button>
                            <button className="icon-btn ai-summary-btn" onClick={handleSummarize} title="AI Tóm tắt" style={{ color: '#7c3aed' }}>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            </button>
                          </>
                        )}
                        <button className="icon-btn" onClick={viewMembers} title="Thông tin">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                        </button>
                        {(chatDetail?.roleInGroup === 'admin' || chatDetail?.roleInGroup === 'owner') && (
                          <button className="icon-btn" onClick={updateGroupInfo} title="Cài đặt nhóm">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                          </button>
                        )}
                      </div>

                    </div>
                    <div className="chat-messages">
                      {Array.isArray(messages) && messages.map((m, i) => (
                        <div key={i} className={`message-container ${String(m?.senderId) === String(user.userId) ? 'sent' : 'received'}`}>
                          <div className="message-bubble" title={m?.createdAt ? new Date(m.createdAt).toLocaleString() : ''}>
                            {m?.messageType === 'media' || m?.messageType === 'image' ? (
                              <img src={m?.fileUrl} alt="media" style={{ maxWidth: '100%', borderRadius: '10px', display: 'block' }} />
                            ) : m?.messageType === 'voice' ? (
                              <audio controls src={m?.audioUrl || m?.fileUrl} style={{ maxWidth: '200px' }} />
                            ) : m?.messageType === 'file' ? (
                              <a href={m?.fileUrl} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>📄 Tệp đính kèm</a>
                            ) : (
                              m?.content || ''
                            )}
                          </div>
                        </div>
                      ))}

                      {Object.keys(typingUsers[activeChat] || {}).length > 0 && (
                        <div className="message-container received">
                          <div className="message-bubble typing-bubble">
                            <div className="typing-dots"><span></span><span></span><span></span></div>
                          </div>
                        </div>
                      )}

                      <div ref={messagesEndRef} />
                    </div>
                    <form className="chat-input-area" onSubmit={sendMessage}>
                      {isRecording && (
                        <div className="recording-overlay">
                          <span>🔴 Ghi âm...</span>
                        </div>
                      )}
                      <div className="input-actions-left">
                        <button type="button" className={`icon-btn ${isRecording ? 'active' : ''}`} onClick={isRecording ? stopRecording : startRecording} title="Ghi âm">
                          {isRecording ? (
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'red', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontSize: '0.8rem', color: 'white' }}>⏹️</span>
                            </div>
                          ) : (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="#0084ff"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" /><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" /></svg>
                          )}
                        </button>
                        <label className="icon-btn" title="Đính kèm">
                          <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} />
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0084ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                        </label>
                      </div>
                      <div className="input-wrapper">
                        <input type="text" placeholder="Aa" value={newMessage} onChange={e => { setNewMessage(e.target.value); handleTyping() }} disabled={isRecording} />
                      </div>
                      <button type="submit" className="send-btn" disabled={isRecording || !newMessage.trim()} style={{ background: (!newMessage.trim() || isRecording) ? '#f0f2f5' : '#0084ff' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill={(!newMessage.trim() || isRecording) ? "#bcc0c4" : "#ffffff"}><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
                      </button>
                    </form>
                  </>
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>Hãy chọn một cuộc hội thoại</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'contacts' && (
            <div className="contacts-layout" style={{ flexDirection: 'column' }}>
              <div className="search-section" style={{ marginBottom: '2rem' }}>
                <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem' }}>
                  <input type="text" placeholder="Tìm người dùng..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: '1px solid #ddd' }} />
                  <button type="submit" className="btn-primary">Tìm</button>
                </form>
                {searchResults.length > 0 && (
                  <div style={{ marginTop: '1rem', background: 'white', borderRadius: '10px', padding: '1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    {searchResults.map(r => (
                      <div key={r.userId} className="contact-item-card" style={{ justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div className="user-avatar-med">{r.fullName?.charAt(0) || '?'}</div>
                          <span>{r.fullName || 'Người dùng'}</span>
                        </div>
                        <button className="btn-primary" onClick={() => addContact(r.userId)}>+ Kết bạn</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="my-contacts-section">
                <h3>Danh bạ của bạn</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                  {contacts.map(c => (
                    <div key={c.userId} className="contact-item-card" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div className="user-avatar-med">{c.fullName?.charAt(0) || '?'}</div>
                        <div className="contact-item-info">
                          <span style={{ fontWeight: 700, display: 'block' }}>{c.fullName || 'Người dùng'}</span>
                          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Online</span>
                        </div>
                      </div>
                      <button className="icon-btn" onClick={() => handleStartPersonalChat(c.userId)} title="Nhắn tin & Gọi">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="profile-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
              <div className="profile-sidebar-info" style={{ textAlign: 'center', padding: '2rem' }}>
                <div className="user-avatar-med" style={{ width: 100, height: 100, fontSize: '3rem', margin: '0 auto 1rem' }}>{user.fullName?.charAt(0)}</div>
                <h2>{profileData.fullName || user.fullName}</h2>
                <p>{user.email}</p>
              </div>
              <div className="profile-form-container" style={{ flex: 1 }}>
                <form onSubmit={async e => { e.preventDefault(); try { await axios.patch(`${API_URL}/users/profile`, profileData, axiosConfig); setIsEditing(false); fetchProfile(); } catch (err) { alert(err.response?.data?.message); } }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div><label>Họ và tên</label><input type="text" value={profileData.fullName} onChange={e => setProfileData({ ...profileData, fullName: e.target.value })} disabled={!isEditing} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd' }} /></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    {!isEditing ? <button type="button" className="btn-primary" onClick={() => setIsEditing(true)}>Chỉnh sửa hồ sơ</button> : <><button type="button" onClick={() => setIsEditing(false)}>Hủy</button><button type="submit" className="btn-primary">Lưu</button></>}
                  </div>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'aibot' && (
            <div className="ai-bot-container" style={{ height: 'calc(100vh - 160px)', display: 'flex', flexDirection: 'column', background: 'white', borderRadius: '20px', overflow: 'hidden', border: '1px solid #eee', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
              <div className="ai-bot-header" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)', color: 'white' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10 10 10 0 0 1-10-10 10 10 0 0 1 10-10z"></path><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>
                  Trợ lý AI Nội bộ
                </h3>
                <p style={{ margin: '5px 0 0', opacity: 0.8, fontSize: '0.9rem' }}>Giải đáp thắc mắc về quy định, chính sách và dữ liệu nội bộ.</p>
              </div>
              
              <div className="ai-bot-messages" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: '#f8fafc' }}>
                {aiBotMessages.map((m, idx) => (
                  <div key={idx} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%', display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ padding: '0.8rem 1.2rem', borderRadius: m.role === 'user' ? '18px 18px 0 18px' : '18px 18px 18px 0', background: m.role === 'user' ? '#7c3aed' : 'white', color: m.role === 'user' ? 'white' : '#1e293b', boxShadow: m.role === 'user' ? '0 4px 12px rgba(124, 58, 237, 0.2)' : '0 4px 12px rgba(0,0,0,0.03)', border: m.role === 'user' ? 'none' : '1px solid #f1f5f9', whiteSpace: 'pre-wrap' }}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {isAiProcessing && (
                  <div style={{ alignSelf: 'flex-start', background: 'white', padding: '0.8rem 1.2rem', borderRadius: '18px 18px 18px 0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
                    <div className="typing-dots"><span></span><span></span><span></span></div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleAiBotQuery} style={{ padding: '1.25rem', borderTop: '1px solid #eee', background: 'white', display: 'flex', gap: '1rem' }}>
                <input 
                  type="text" 
                  value={aiBotInput} 
                  onChange={e => setAiBotInput(e.target.value)} 
                  placeholder="Nhập câu hỏi tại đây..." 
                  style={{ flex: 1, padding: '0.75rem 1.2rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', transition: 'all 0.2s' }}
                  onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />
                <button type="submit" disabled={!aiBotInput.trim() || isAiProcessing} style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', background: (!aiBotInput.trim() || isAiProcessing) ? '#f1f5f9' : '#7c3aed', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>Gửi</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
              </form>
            </div>
          )}

          {showSummaryModal && (
            <div className="modal-overlay" onClick={() => setShowSummaryModal(false)}>
              <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
                <div className="modal-header" style={{ borderBottom: '1px solid #eee', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#7c3aed' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    AI Tóm tắt hội thoại
                  </h3>
                  <button className="btn-close" onClick={() => setShowSummaryModal(false)}>✖</button>
                </div>
                <div className="summary-body" style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '15px', border: '1px solid #e2e8f0', minHeight: '150px', maxHeight: '400px', overflowY: 'auto' }}>
                  {isSummarizing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem' }}>
                      <div className="typing-dots"><span></span><span></span><span></span></div>
                      <span style={{ color: '#64748b', fontSize: '0.9rem' }}>AI đang đọc cuộc trò chuyện...</span>
                    </div>
                  ) : (
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#334155' }}>
                      {aiSummary}
                    </div>
                  )}
                </div>
                <div className="modal-footer" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn-primary" onClick={() => setShowSummaryModal(false)} style={{ background: '#7c3aed' }}>Đóng</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'admin' && (
            <div className="admin-management-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.4s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b' }}>Quản lý nhân sự</h2>
                  <p style={{ color: '#64748b' }}>Cấp tài khoản, duyệt thành viên và quản lý quyền hạn.</p>
                </div>
                <button className="btn-primary" onClick={() => setShowCreateUserModal(true)} style={{ background: '#f59e0b', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.2)' }}>
                  + Cấp tài khoản mới
                </button>
              </div>

              <div className="admin-tabs" style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #eee' }}>
                <button onClick={() => setAdminSubTab('all')} style={{ padding: '0.75rem 1.5rem', border: 'none', background: 'none', borderBottom: adminSubTab === 'all' ? '3px solid #f59e0b' : 'none', fontWeight: 600, color: adminSubTab === 'all' ? '#f59e0b' : '#64748b', cursor: 'pointer' }}>Tất cả nhân viên</button>
                <button onClick={() => setAdminSubTab('pending')} style={{ padding: '0.75rem 1.5rem', border: 'none', background: 'none', borderBottom: adminSubTab === 'pending' ? '3px solid #f59e0b' : 'none', fontWeight: 600, color: adminSubTab === 'pending' ? '#f59e0b' : '#64748b', cursor: 'pointer' }}>
                  Chờ duyệt {pendingUsers.length > 0 && <span style={{ background: '#ef4444', color: 'white', padding: '1px 6px', borderRadius: '10px', fontSize: '0.7rem' }}>{pendingUsers.length}</span>}
                </button>
              </div>

              <div className="admin-content-list" style={{ background: 'white', borderRadius: '20px', padding: '1.5rem', border: '1px solid #eee', minHeight: '400px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontSize: '0.9rem' }}>
                      <th style={{ padding: '1rem' }}>Nhân viên</th>
                      <th style={{ padding: '1rem' }}>Chức vụ / Email</th>
                      <th style={{ padding: '1rem' }}>Quyền</th>
                      <th style={{ padding: '1rem' }}>Trạng thái</th>
                      <th style={{ padding: '1rem' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(adminSubTab === 'all' ? adminUsers : pendingUsers).map(u => (
                      <tr key={u.userId} style={{ borderBottom: '1px solid #f8fafc', transition: 'all 0.2s' }}>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div className="user-avatar-small" style={{ background: '#f59e0b' }}>{u.fullName?.charAt(0)}</div>
                            <span style={{ fontWeight: 600 }}>{u.fullName}</span>
                          </div>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ fontSize: '0.85rem' }}>{u.position || 'Nhân viên'}</div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{u.email || u.userName}</div>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <select 
                            value={u.role || 'staff'} 
                            onChange={(e) => updateUserRole(u.userId, e.target.value === 'admin' ? 1 : 2)}
                            style={{ padding: '0.3rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }}
                          >
                            <option value="staff">Staff</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, background: u.status === 'locked' ? '#fee2e2' : '#ecfdf5', color: u.status === 'locked' ? '#ef4444' : '#10b981', textTransform: 'uppercase' }}>
                            {u.status || 'active'}
                          </span>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {adminSubTab === 'pending' ? (
                              <button onClick={() => handleApproveUser(u.userId)} className="btn-mini-action" style={{ background: '#f59e0b', color: 'white' }}>Duyệt</button>
                            ) : (
                              <>
                                <button onClick={() => updateUserStatus(u.userId, u.status === 'locked' ? 'active' : 'locked')} className="btn-mini-action" title={u.status === 'locked' ? 'Mở khóa' : 'Khóa'}>
                                  {u.status === 'locked' ? '🔓' : '🔒'}
                                </button>
                                <button onClick={() => deleteUser(u.userId)} className="btn-mini-action delete" title="Xóa">🗑️</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(adminSubTab === 'all' ? adminUsers : pendingUsers).length === 0 && (
                      <tr><td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Không tìm thấy nhân viên nào.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {showCreateUserModal && (
            <div className="modal-overlay" onClick={() => setShowCreateUserModal(false)}>
              <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div className="modal-header">
                  <h3>Cấp tài khoản nhân viên</h3>
                  <button className="btn-close" onClick={() => setShowCreateUserModal(false)}>✖</button>
                </div>
                <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                  <div className="form-group">
                    <label>Họ và tên</label>
                    <input type="text" required value={newUserForm.fullName} onChange={e => setNewUserForm({ ...newUserForm, fullName: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd' }} />
                  </div>
                  <div className="form-group">
                    <label>Email đăng nhập</label>
                    <input type="email" required value={newUserForm.email} onChange={e => setNewUserForm({ ...newUserForm, email: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd' }} />
                  </div>
                  <div className="form-group">
                    <label>Mật khẩu khởi tạo</label>
                    <input type="password" required value={newUserForm.password} onChange={e => setNewUserForm({ ...newUserForm, password: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd' }} />
                  </div>
                  <div className="form-group">
                    <label>Vai trò hệ thống</label>
                    <select value={newUserForm.roleId} onChange={e => setNewUserForm({ ...newUserForm, roleId: parseInt(e.target.value) })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd' }}>
                      <option value={2}>Staff (Nhân viên)</option>
                      <option value={1}>Admin (Quản trị viên)</option>
                    </select>
                  </div>
                  <div className="modal-footer" style={{ marginTop: '1rem' }}>
                    <button type="button" onClick={() => setShowCreateUserModal(false)}>Hủy</button>
                    <button type="submit" className="btn-primary" style={{ background: '#f59e0b' }}>Tạo tài khoản</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showMemberModal && (
            <div className="modal-overlay" onClick={() => setShowMemberModal(false)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header"><h3>Thông tin nhóm</h3><button className="btn-close" onClick={() => setShowMemberModal(false)}>✖</button></div>
                <div className="modal-section">
                  <h4>Thành viên</h4>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {members.map(m => (
                      <div key={m.userId} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #eee' }}>
                        <span>{m.fullName} ({m.roleInGroup})</span>
                        {chatDetail?.roleInGroup !== 'member' && m.userId !== String(user.userId) && (
                          <button onClick={() => removeMemberFromGroup(m.userId)} style={{ color: 'red', border: 'none', background: 'none' }}>Xóa</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="modal-section" style={{ marginTop: '1.5rem' }}>
                  <h4>File & Ảnh đã chia sẻ</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px', maxHeight: '150px', overflowY: 'auto' }}>
                    {sharedMedia.map((media, idx) => (
                      media.fileType?.startsWith('image/') ? (
                        <a key={idx} href={media.fileUrl} target="_blank" rel="noreferrer"><img src={media.fileUrl} alt="shared" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: '4px' }} /></a>
                      ) : (
                        <a key={idx} href={media.fileUrl} target="_blank" rel="noreferrer" style={{ gridColumn: 'span 3', padding: '5px', background: '#f0f2f5', borderRadius: '4px', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>📄 {media.fileName || 'Tệp đính kèm'}</a>
                      )
                    ))}
                    {sharedMedia.length === 0 && <small style={{ opacity: 0.5 }}>Chưa có tệp nào được chia sẻ</small>}
                  </div>
                </div>
                <div className="modal-footer" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
                  <button className="btn-danger-outline" onClick={leaveGroup}>Rời nhóm</button>
                  {chatDetail?.roleInGroup === 'owner' && <button className="btn-danger" onClick={deleteConversation}>Giải tán</button>}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'content' && (
            <div className="admin-management-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.4s' }}>
              <div>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b' }}>Quản lý nội dung</h2>
                <p style={{ color: '#64748b' }}>Theo dõi các báo cáo vi phạm và giám sát tính minh bạch của hội thoại.</p>
              </div>

              <div className="admin-tabs" style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #eee' }}>
                <button onClick={() => setContentSubTab('reports')} style={{ padding: '0.75rem 1.5rem', border: 'none', background: 'none', borderBottom: contentSubTab === 'reports' ? '3px solid #ef4444' : 'none', fontWeight: 600, color: contentSubTab === 'reports' ? '#ef4444' : '#64748b', cursor: 'pointer' }}>Báo cáo vi phạm</button>
                <button onClick={() => setContentSubTab('audit')} style={{ padding: '0.75rem 1.5rem', border: 'none', background: 'none', borderBottom: contentSubTab === 'audit' ? '3px solid #ef4444' : 'none', fontWeight: 600, color: contentSubTab === 'audit' ? '#ef4444' : '#64748b', cursor: 'pointer' }}>Giám sát hội thoại</button>
              </div>

              <div className="admin-content-list" style={{ background: 'white', borderRadius: '20px', padding: '1.5rem', border: '1px solid #eee', minHeight: '400px' }}>
                {contentSubTab === 'reports' ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontSize: '0.9rem' }}>
                        <th style={{ padding: '1rem' }}>Người báo cáo</th>
                        <th style={{ padding: '1rem' }}>Đối tượng vi phạm</th>
                        <th style={{ padding: '1rem' }}>Lý do & Bằng chứng</th>
                        <th style={{ padding: '1rem' }}>Trạng thái</th>
                        <th style={{ padding: '1rem' }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map(r => (
                        <tr key={r.reportId} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '1rem' }}>
                            <div style={{ fontWeight: 600 }}>{r.reporter.fullName}</div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{r.reporter.email}</div>
                          </td>
                          <td style={{ padding: '1rem' }}>
                            {r.reportedUser ? (
                              <span style={{ color: '#ef4444', fontWeight: 600 }}>{r.reportedUser.fullName}</span>
                            ) : 'Tin nhắn ẩn danh'}
                          </td>
                          <td style={{ padding: '1rem' }}>
                            <div style={{ fontWeight: 600, color: '#6b7280' }}>{r.reasonType}</div>
                            <div style={{ fontSize: '0.85rem', color: '#374151', fontStyle: 'italic' }}>"{r.description}"</div>
                            {r.reportedMessageId && <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px' }}>MsgID: {r.reportedMessageId}</div>}
                          </td>
                          <td style={{ padding: '1rem' }}>
                            <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, background: r.status === 'processed' ? '#ecfdf5' : '#fff7ed', color: r.status === 'processed' ? '#10b981' : '#f59e0b' }}>
                              {r.status === 'processed' ? 'ĐÃ XỬ LÝ' : 'ĐANG CHỜ'}
                            </span>
                          </td>
                          <td style={{ padding: '1rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              {r.status !== 'processed' && (
                                <>
                                  <button onClick={() => processReport(r.reportId, 'block', 'Locked for violation')} className="btn-mini-action" style={{ background: '#ef4444', color: 'white' }}>Khóa User</button>
                                  <button onClick={() => processReport(r.reportId, 'dismiss', 'Dismissed')} className="btn-mini-action">Bỏ qua</button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {reports.length === 0 && <tr><td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Chưa có báo cáo vi phạm nào.</td></tr>}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem' }}>
                    <div className="audit-sidebar" style={{ borderRight: '1px solid #eee', paddingRight: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h4 style={{ margin: 0, color: '#64748b' }}>Chọn phòng chat ({adminConversations.length})</h4>
                        <button onClick={fetchAdminConversations} style={{ background: 'none', border: 'none', color: '#1e293b', cursor: 'pointer', padding: '4px' }} title="Làm mới danh sách">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '500px', overflowY: 'auto' }}>
                        {adminConversations.map(c => (
                          <div 
                            key={c.conversationId} 
                            onClick={() => { setAuditRoomId(c.conversationId); setAuditMsgs([]); setHasAudited(false); }}
                            style={{ 
                              padding: '0.75rem', 
                              borderRadius: '8px', 
                              cursor: 'pointer', 
                              background: auditRoomId === c.conversationId ? '#f8fafc' : 'transparent',
                              border: auditRoomId === c.conversationId ? '1px solid #e2e8f0' : '1px solid transparent',
                              transition: 'all 0.2s'
                            }}
                          >
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.conversationName}</div>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>ID: {c.conversationId} • {c.isGroup ? 'Nhóm' : 'Cá nhân'}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <form onSubmit={handleAuditChat} style={{ display: 'flex', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px' }}>
                        <input 
                          type="number" 
                          placeholder="ID đã chọn..." 
                          readOnly
                          value={auditRoomId} 
                          style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd', background: '#fff' }}
                        />
                        <button type="submit" disabled={!auditRoomId || isContentLoading} className="btn-primary" style={{ background: '#1e293b' }}>
                          {isContentLoading ? 'Đang truy xuất...' : 'Truy xuất lịch sử'}
                        </button>
                      </form>
                      
                      <div className="audit-results" style={{ minHeight: '400px', maxHeight: '500px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '12px', padding: '1rem' }}>
                        {auditMsgs.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <p style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600 }}>⚠️ CẢNH BÁO: Mọi dữ liệu bạn xem đều được ghi log để đảm bảo tính minh bạch.</p>
                            {auditMsgs.map(m => (
                              <div key={m.messageId} style={{ padding: '0.75rem', background: '#fff', border: '1px solid #f1f5f9', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{m.senderName}</span>
                                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{new Date(m.createdAt).toLocaleString()}</span>
                                </div>
                                <div style={{ fontSize: '0.95rem' }}>{m.content}</div>
                              </div>
                            ))}
                          </div>
                        ) : hasAudited ? (
                          <p style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Phòng chat này chưa có bất kỳ tin nhắn nào.</p>
                        ) : (
                          <p style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>{auditRoomId ? 'Nhấn "Truy xuất" để xem nội dung.' : 'Chọn một phòng từ danh sách bên trái.'}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'config' && user.role?.toLowerCase() === 'admin' && (
            <div className="admin-dashboard fade-in">
              <div className="section-header">
                <h2>Cấu hình hệ thống</h2>
                <p>Kiểm soát cài đặt toàn cục và giám sát trạng thái sức khỏe của hạ tầng.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '2rem', marginTop: '2rem' }}>
                <div style={{ background: '#fff', padding: '2rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                  <h3 style={{ marginBottom: '1.5rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    Công tắc hệ thống
                  </h3>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: '#f8fafc', borderRadius: '8px', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#334155' }}>Mở Đăng Ký Tài Khoản</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Cho phép nhân sự mới tự tạo tài khoản.</div>
                    </div>
                    <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '24px' }}>
                      <input type="checkbox" checked={sysConfig.isRegistrationEnabled} onChange={() => toggleConfig('registration')} style={{ opacity: 0, width: 0, height: 0 }} />
                      <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: sysConfig.isRegistrationEnabled ? '#10b981' : '#cbd5e1', transition: '.3s', borderRadius: '34px' }}>
                        <span style={{ position: 'absolute', height: '18px', width: '18px', left: sysConfig.isRegistrationEnabled ? '28px' : '3px', bottom: '3px', backgroundColor: 'white', transition: '.3s', borderRadius: '50%' }}></span>
                      </span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: sysConfig.isMaintenanceMode ? '#fee2e2' : '#f8fafc', borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: sysConfig.isMaintenanceMode ? '#dc2626' : '#334155' }}>Chế Độ Bảo Trì</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Tiếp nhận báo lỗi và khóa mọi truy cập công khai.</div>
                    </div>
                    <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '24px' }}>
                      <input type="checkbox" checked={sysConfig.isMaintenanceMode} onChange={() => toggleConfig('maintenance')} style={{ opacity: 0, width: 0, height: 0 }} />
                      <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: sysConfig.isMaintenanceMode ? '#ef4444' : '#cbd5e1', transition: '.3s', borderRadius: '34px' }}>
                        <span style={{ position: 'absolute', height: '18px', width: '18px', left: sysConfig.isMaintenanceMode ? '28px' : '3px', bottom: '3px', backgroundColor: 'white', transition: '.3s', borderRadius: '50%' }}></span>
                      </span>
                    </label>
                  </div>
                </div>

                <div style={{ background: '#fff', padding: '2rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                  <h3 style={{ marginBottom: '1.5rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                    Sức khỏe hạ tầng
                    <button onClick={fetchSystemHealth} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Làm mới</button>
                  </h3>

                  {sysHealth ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                        <span style={{ fontWeight: 600, color: '#475569' }}>Database (PostgreSQL)</span>
                        <span style={{ color: sysHealth.database === 'connected' ? '#10b981' : '#ef4444', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.75rem' }}>{sysHealth.database}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                        <span style={{ fontWeight: 600, color: '#475569' }}>Realtime (Socket.IO)</span>
                        <span style={{ color: sysHealth.socket === 'stable' ? '#10b981' : '#ef4444', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.75rem' }}>{sysHealth.socket}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                        <span style={{ fontWeight: 600, color: '#475569' }}>Push Notify (Firebase)</span>
                        <span style={{ color: sysHealth.firebase === 'connected' ? '#10b981' : '#ef4444', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.75rem' }}>{sysHealth.firebase}</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1.5s linear infinite', margin: '0 auto 1rem' }}><circle cx="12" cy="12" r="10"></circle><path d="M12 2a10 10 0 0 1 10 10"></path></svg>
                      Đang lấy trạng thái các Node...
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      <CallModal ref={callModalRef} socket={socketRef.current} currentUser={user} />

      {showGroupCall && (
        <div className="call-overlay">
          <div className="call-container fullscreen-modal" style={{ background: '#000' }}>
            <div className="conv-header" style={{ background: '#111', borderBottom: '1px solid #333', padding: '1rem' }}>
              <h3 style={{ color: 'white', margin: 0, fontSize: '1.2rem' }}>{chatDetail?.conversationName} - Phòng Gọi Tập Thể</h3>
              <button className="icon-btn" onClick={() => setShowGroupCall(false)} style={{ background: '#ff4444', color: 'white' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <iframe
              title="group-call"
              allow="camera; microphone; fullscreen; display-capture; autoplay"
              src={`https://meet.ffmuc.net/NexusChat_Room_${activeChat}`}
              style={{ width: '100%', height: 'calc(100% - 60px)', border: 'none' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}



export default Home
