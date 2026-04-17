import mongoose , { Document, Schema} from 'mongoose';

interface IUser extends Document {
    name: string;
    email: string;
    password: string;
    createdAt?: Date;
    updatedAt?: Date;
}

const userSchema = new Schema<IUser>({
    name: {type: String, required: true},
    email: {type: String, required: true, unique: true, lowercase: true, trim: true, match: [/\S+@\S+\.\S+/, "Please enter a valid email"]},
    password: {type: String, required: true}
}, {timestamps: true});

export default mongoose.model<IUser>("User", userSchema);