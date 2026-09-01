import os

def update_events_ts():
    path = r"f:\ARTech\Usher-Management\Usher-Management\artifacts\api-server\src\routes\events.ts"
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # GET /events/:id assignments usher selection
    target1 = "shoeSize: ushersTable.shoeSize, dressSize: ushersTable.dressSize, gender: ushersTable.gender"
    replacement1 = "shoeSize: ushersTable.shoeSize, dressSize: ushersTable.dressSize, shirtSize: ushersTable.shirtSize, tShirtSize: ushersTable.tShirtSize, pantsSize: ushersTable.pantsSize, shortsSize: ushersTable.shortsSize, gender: ushersTable.gender"
    
    # POST /events and GET /events/:id usher selection
    target2 = """      shoeSize: ushersTable.shoeSize,
      profilePhotoKey: ushersTable.profilePhotoKey,"""
    replacement2 = """      shoeSize: ushersTable.shoeSize,
      shirtSize: ushersTable.shirtSize,
      tShirtSize: ushersTable.tShirtSize,
      pantsSize: ushersTable.pantsSize,
      shortsSize: ushersTable.shortsSize,
      profilePhotoKey: ushersTable.profilePhotoKey,"""

    content = content.replace(target1, replacement1)
    content = content.replace(target2, replacement2)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def update_admin_app_event_details():
    path = r"f:\ARTech\Usher-Management\Usher-Management\artifacts\admin-app\src\pages\event-details.tsx"
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # assigned ushers view
    target1 = """                              {assignment.usher?.gender === 'female' && assignment.usher?.dressSize && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-normal">Dress: {assignment.usher.dressSize}</Badge>
                              )}
                              {assignment.usher?.shoeSize && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-normal">Shoe: {assignment.usher.shoeSize}</Badge>
                              )}"""
    
    replacement1 = """                              {assignment.usher?.shirtSize && <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-normal">Shirt: {assignment.usher.shirtSize}</Badge>}
                              {assignment.usher?.tShirtSize && <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-normal">T-Shirt: {assignment.usher.tShirtSize}</Badge>}
                              {assignment.usher?.pantsSize && <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-normal">Pants: {assignment.usher.pantsSize}</Badge>}
                              {assignment.usher?.shortsSize && <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-normal">Shorts: {assignment.usher.shortsSize}</Badge>}
                              {assignment.usher?.gender === 'female' && assignment.usher?.dressSize && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-normal">Dress: {assignment.usher.dressSize}</Badge>
                              )}
                              {assignment.usher?.shoeSize && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-normal">Shoe: {assignment.usher.shoeSize}</Badge>
                              )}"""

    # pending applicants view
    target2 = """                             {applicant.usher?.gender === 'female' && applicant.usher?.dressSize && <span>| Dress: {applicant.usher.dressSize}</span>}
                             {applicant.usher?.shoeSize && <span>| Shoe: {applicant.usher.shoeSize}</span>}"""
    
    replacement2 = """                             {applicant.usher?.shirtSize && <span>| Shirt: {applicant.usher.shirtSize}</span>}
                             {applicant.usher?.tShirtSize && <span>| T-Shirt: {applicant.usher.tShirtSize}</span>}
                             {applicant.usher?.pantsSize && <span>| Pants: {applicant.usher.pantsSize}</span>}
                             {applicant.usher?.shortsSize && <span>| Shorts: {applicant.usher.shortsSize}</span>}
                             {applicant.usher?.gender === 'female' && applicant.usher?.dressSize && <span>| Dress: {applicant.usher.dressSize}</span>}
                             {applicant.usher?.shoeSize && <span>| Shoe: {applicant.usher.shoeSize}</span>}"""

    content = content.replace(target1, replacement1)
    content = content.replace(target2, replacement2)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == "__main__":
    update_events_ts()
    update_admin_app_event_details()
    print("Files updated!")
