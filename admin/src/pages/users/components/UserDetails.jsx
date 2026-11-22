import React from 'react'
import userAvater from '../../../assets/preferances/user-avarter.png'

export default function UserDetails({ user }) {
  return (
    <div>
      <dialog id="userDetailsModal" className="modal">
        <div className="modal-box w-11/12 max-w-4xl p-0 border-2 border-white">
          <div className="modal-header bg-blue-200 h-16 relative">
            <img
              className="h-20 border w-20 rounded-full absolute bottom-0 left-3 transform translate-y-1/2"
              src={user?.profile_image ? user.profile_image : userAvater}
              alt="User Image"
            />
            {/* <div className="modal-action m-0">
              <form method="dialog">
                <button className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3 bg-white">✕</button>
              </form>
            </div> */}
          </div>
          <div className="modal-body px-4 pb-4">
            <div className="flex justify-end items-center gap-2 mt-3">
              <button className="btn btn-sm btn-outline border-zinc-400">Copy Link</button>
              <button className="btn btn-sm btn-outline border-zinc-400">Edit Profile</button>
            </div>
            <h3 className="text-xl font-bold">{user?.first_name} {user?.last_name}</h3>
            <h6 className="text-zinc-600">{user?.email}</h6>
            {/* <div className="py-4 border-t-zinc-400 mt-5"> </div> */}
          </div>
          <div className="modal-action p-4">
            <form method="dialog">
              <button className="btn">Close</button>
            </form>
          </div>
        </div>
      </dialog>
    </div>
  )
}
